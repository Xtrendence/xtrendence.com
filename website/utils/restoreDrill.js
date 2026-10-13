import { execFile, spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { crc32 } from "node:zlib";
import { backupDir, backupRunning, newestValidBackup } from "./backups.js";
import { sendBotNotification } from "./utils.js";

// Restores the newest backup in an offline container and checks every file and repo

const run = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(__dirname, "../data/restore-drill.json");

// On the backup drive, so the ZIP can be hard linked in
const scratchDir = () => path.join(backupDir(), ".restore-drill");
const SCRATCH_NAME = /^drill-\d+$/;

const IMAGE = "restore-drill:22.04";
const CONTAINER = "restore-drill";
const HOME = "/home/drill";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const EVERY = 14 * DAY;
// After the 04:00 backup has had time to finish
const SCHEDULE_HOUR = 5;
const TIMEOUT = 3 * HOUR;
const KEEP_RESULTS = 12;
const LOG_LINES = 60;

// The steps that put files back. The rest need sudo, Docker or the network
const RUN_STEPS = new Set(["space", "repos", "data", "home"]);

// In order. restore.sh's free space step is folded into unpacking
const PHASES = [
	["prepare", "Preparing the container"],
	["test", "Testing the ZIP"],
	["unpack", "Unpacking the backup"],
	["repos", "Restoring repos"],
	["data", "Restoring files"],
	["home", "Restoring home files"],
	["files", "Checking every file"],
	["commits", "Checking repos"],
	["cleanup", "Cleaning up"],
];

let running = null;

class Cancelled extends Error {}

function readState() {
	try {
		return { results: [], ...JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) };
	} catch {
		return { results: [] };
	}
}

function writeState(state) {
	fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
	fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 4));
}

// A cancelled drill proves nothing, so health and scheduling skip it
function lastCompleted(results = readState().results) {
	return results.filter((result) => !result.cancelled).at(-1) ?? null;
}

// The user inside matches this one, so no sudo is needed for cleanup
async function ensureImage() {
	const { stdout } = await run("docker", ["images", "-q", IMAGE]);
	if (stdout.trim()) return;

	const { uid, gid } = os.userInfo();
	const dockerfile = [
		"FROM ubuntu:22.04",
		"RUN apt-get update && apt-get install -y --no-install-recommends git python3 unzip rsync ca-certificates && rm -rf /var/lib/apt/lists/*",
		`RUN groupadd -g ${gid} drill && useradd -m -u ${uid} -g ${gid} -d ${HOME} -s /bin/bash drill`,
	].join("\n");

	await new Promise((resolve, reject) => {
		const build = spawn("docker", ["build", "-q", "-t", IMAGE, "-"], { stdio: ["pipe", "ignore", "pipe"] });
		let stderr = "";
		build.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		build.on("error", reject);
		build.on("close", (code) =>
			code === 0 ? resolve() : reject(new Error(`Building the drill image failed: ${stderr.trim().split("\n").pop()}`)),
		);
		build.stdin.end(dockerfile);
	});
}

// Only folders this module names are ever removed
function removeScratch(dir) {
	if (path.dirname(dir) !== scratchDir() || !SCRATCH_NAME.test(path.basename(dir))) return;
	fs.rmSync(dir, { recursive: true, force: true });
}

// Read from the backup's own restore.sh, so steps added later are skipped too
async function stepsToSkip(zip) {
	const { stdout } = await run("unzip", ["-p", zip, "restore.sh"], { maxBuffer: 16 * 1024 * 1024 });
	const ids = [...stdout.matchAll(/\badd (\w+) "/g)].map((match) => match[1]);
	return [...new Set(ids)].filter((id) => !RUN_STEPS.has(id));
}

function phase(id) {
	return running.phases.find((entry) => entry.id === id);
}

// Starts a phase, closing any still open before it
function enter(id) {
	if (running.cancelled) throw new Cancelled();
	const now = new Date().toISOString();
	for (const entry of running.phases) {
		if (entry.id === id) break;
		if (entry.state === "active") {
			entry.state = "done";
			entry.finishedAt = now;
		}
	}
	const entry = phase(id);
	if (entry.state !== "pending") return;
	entry.state = "active";
	entry.startedAt = now;
	running.phase = entry.label;
}

function progress(id, done, total, unit) {
	phase(id).progress = { done, total, unit };
}

function log(line) {
	running.log.push(line);
	if (running.log.length > LOG_LINES) running.log.shift();
}

// Progress is read from the container's processes in /proc

function readProc(file) {
	try {
		return fs.readFileSync(file, "utf-8");
	} catch {
		return "";
	}
}

function openFiles(pid) {
	let fds = [];
	try {
		fds = fs.readdirSync(`/proc/${pid}/fd`);
	} catch {
		return [];
	}
	return fds
		.map((fd) => {
			try {
				return { fd, target: fs.readlinkSync(`/proc/${pid}/fd/${fd}`) };
			} catch {
				return null;
			}
		})
		.filter((entry) => entry?.target.startsWith("/"));
}

function readPosition(pid, fd) {
	return Number(readProc(`/proc/${pid}/fdinfo/${fd}`).match(/^pos:\s+(\d+)/m)?.[1] ?? 0);
}

function written(pid) {
	return Number(readProc(`/proc/${pid}/io`).match(/^wchar:\s+(\d+)/m)?.[1] ?? 0);
}

const homePath = (value) => value.replaceAll(`${HOME}/`, "~/");
const documentsPath = (target) => target.replace(`${HOME}/Documents/`, "");

async function inspectContainer(totals) {
	let stdout;
	try {
		({ stdout } = await run("docker", ["top", CONTAINER, "-eo", "pid,args"]));
	} catch {
		return;
	}
	if (!running) return;

	const processes = stdout
		.split("\n")
		.slice(1)
		.map((line) => line.trim().match(/^(\d+)\s+(.+)$/))
		.filter(Boolean)
		.map(([, pid, args]) => ({ pid, args, name: args.split(/\s+/)[0].split("/").pop() }));

	// rsync runs as three identical processes
	running.inside = [
		...new Set(
			processes
				.filter((process) => !/^(bash|sh|sleep|cat|tee|wc|head|tr|mktemp)$/.test(process.name))
				.map((process) => homePath(process.args).slice(0, 160)),
		),
	].slice(0, 6);

	// unzip reads the ZIP front to back, so its read position is its progress
	const unzip = processes.find((process) => process.name === "unzip" && !/ restore\.sh$/.test(process.args));
	if (unzip) {
		const files = openFiles(unzip.pid);
		const zip = files.find((file) => file.target.endsWith(".zip"));
		const id = /\s-t/.test(unzip.args) ? "test" : "unpack";
		if (zip) {
			enter(id);
			const entry = phase(id);
			entry.progress = { done: readPosition(unzip.pid, zip.fd), total: totals.zipBytes, unit: "bytes" };
			const out = files.find((file) => file.target.startsWith(`${HOME}/Documents/bak/`));
			entry.current = out ? documentsPath(out.target) : (entry.current ?? null);
		}
	}

	// Sender and receiver write the same bytes, so take the larger
	const rsyncs = processes.filter((process) => process.name === "rsync");
	if (rsyncs.length && phase("data").state === "active") {
		const entry = phase("data");
		entry.progress = { done: Math.max(...rsyncs.map((process) => written(process.pid))), total: totals.documentsBytes, unit: "bytes" };
		const out = rsyncs
			.flatMap((process) => openFiles(process.pid))
			.find((file) => file.target.startsWith(`${HOME}/Documents/`) && !file.target.startsWith(`${HOME}/Documents/bak/`));
		if (out) entry.current = documentsPath(out.target).replace(/\/\.([^/]+)\.\w{6}$/, "/$1");
	}
	if (phase("data").state === "active" && !rsyncs.length && processes.some((process) => process.name.startsWith("python"))) {
		phase("data").current = "Working out which files to copy";
	}

	const git = processes.find((process) => process.name === "git" && / (clone|fetch|checkout) /.test(process.args));
	if (git && phase("repos").state === "active") {
		const target = git.args.split(/\s+/).at(-1);
		phase("repos").current = target.startsWith(HOME) ? documentsPath(target) || "~/Documents" : homePath(git.args).slice(0, 120);
	}
}

function restoreInContainer(dir, zipName, skip, totals, zipMount) {
	const script = [
		"set -e",
		"cd ~/Documents",
		`unzip -q -o ${zipName} restore.sh`,
		`RESTORE_SKIP="${skip.join(" ")}" ./restore.sh --yes --child ${zipName}`,
	].join(" && ");

	const steps = new Map();
	let reposDone = 0;

	const handle = (line) => {
		const event = line.match(/^@@(\w+) (.*)$/);
		if (event?.[1] === "STEP") {
			let step;
			try {
				step = JSON.parse(event[2]);
			} catch {
				return;
			}
			if (!RUN_STEPS.has(step.id)) return;
			steps.set(step.id, step);
			if (step.id !== "space" && ["checking", "running"].includes(step.state)) {
				enter(step.id);
				if (step.id === "repos") progress("repos", reposDone, totals.repos, "repos");
			}
			return;
		}
		if (event) return;

		if (/^Extracting bak\//.test(line)) enter("unpack");
		if (/^\s*Restoring .+ from /.test(line) && phase("repos").state === "active") {
			reposDone++;
			progress("repos", reposDone, totals.repos, "repos");
		}
		log(line);
	};

	return new Promise((resolve, reject) => {
		const child = spawn(
			"docker",
			[
				"run",
				"--rm",
				"--name",
				CONTAINER,
				"--network",
				"none",
				"--user",
				`${os.userInfo().uid}:${os.userInfo().gid}`,
				"-e",
				`HOME=${HOME}`,
				"-e",
				"USER=drill",
				"-v",
				`${dir}:${HOME}`,
				...(zipMount ? ["-v", `${zipMount}:${HOME}/Documents/${zipName}:ro`] : []),
				"-w",
				HOME,
				IMAGE,
				"bash",
				"-c",
				script,
			],
			{ stdio: ["ignore", "pipe", "pipe"] },
		);

		let sampling = false;
		const sampler = setInterval(() => {
			if (sampling) return;
			sampling = true;
			inspectContainer(totals)
				.catch(() => {})
				.finally(() => {
					sampling = false;
				});
		}, 1500);

		let buffer = "";
		const take = (chunk) => {
			buffer += chunk;
			const lines = buffer.split("\n");
			buffer = lines.pop();
			for (const line of lines) {
				try {
					handle(line);
				} catch {
					// A cancel from enter, the container kill ends the run
				}
			}
		};
		child.stdout.on("data", take);
		child.stderr.on("data", take);

		const timer = setTimeout(() => {
			run("docker", ["kill", CONTAINER]).catch(() => {});
		}, TIMEOUT);

		child.on("error", reject);
		child.on("close", (code) => {
			clearTimeout(timer);
			clearInterval(sampler);
			running.inside = [];
			if (buffer) handle(buffer);
			resolve({ code, steps });
		});
	});
}

// Each entry's size and CRC-32. The name is everything after the seventh column
async function zipEntries(zip) {
	const { stdout } = await run("unzip", ["-v", zip], { maxBuffer: 256 * 1024 * 1024 });
	const entries = new Map();
	for (const line of stdout.split("\n")) {
		const match = line.match(/^\s*(\d+)\s+\S+\s+\d+\s+\S+\s+\S+\s+\S+\s+([0-9a-f]{8})\s+(.+)$/);
		if (!match || match[3].endsWith("/")) continue;
		entries.set(match[3], { size: Number(match[1]), crc: match[2] });
	}
	return entries;
}

function fileCrc(file, onBytes) {
	return new Promise((resolve, reject) => {
		let value = 0;
		const stream = createReadStream(file);
		stream
			.on("data", (chunk) => {
				if (running.cancelled) {
					stream.destroy(new Cancelled());
					return;
				}
				value = crc32(chunk, value);
				onBytes(chunk.length);
			})
			.on("error", reject)
			.on("end", () => resolve((value >>> 0).toString(16).padStart(8, "0")));
	});
}

function restoredPath(dir, name) {
	if (name.startsWith("bak/documents/")) return path.join(dir, "Documents", name.slice("bak/documents/".length));
	if (name.startsWith("bak/home/")) return path.join(dir, name.slice("bak/home/".length));
	return null;
}

// Every restored file must match its CRC, symlinks only need to exist
async function verifyFiles(dir, entries) {
	const targets = [...entries].map(([name, entry]) => ({ name, entry, target: restoredPath(dir, name) })).filter((item) => item.target);
	const totalBytes = targets.reduce((sum, item) => sum + item.entry.size, 0);
	const mismatched = [];
	const missing = [];
	let bytes = 0;
	let files = 0;

	const report = () => {
		const entry = phase("files");
		entry.progress = { done: bytes, total: totalBytes, unit: "bytes", files, totalFiles: targets.length };
	};
	report();

	for (const { name, entry, target } of targets) {
		if (running.cancelled) throw new Cancelled();
		files++;
		const stat = fs.lstatSync(target, { throwIfNoEntry: false });
		if (!stat) {
			missing.push(name.replace(/^bak\//, ""));
		} else if (!stat.isSymbolicLink()) {
			const crc =
				stat.size === entry.size
					? await fileCrc(target, (length) => {
							bytes += length;
						})
					: null;
			if (crc !== entry.crc) mismatched.push(name.replace(/^bak\//, ""));
			if (crc === null) bytes += entry.size;
		}
		if (files % 25 === 0) report();
	}
	report();

	return { checked: targets.length, missing, mismatched };
}

async function verifyRepos(dir, manifest) {
	const repos = (manifest.repos ?? []).filter((repo) => repo.bundle && repo.commit);
	const problems = [];
	let done = 0;
	progress("commits", 0, repos.length, "repos");

	for (const repo of repos) {
		if (running.cancelled) throw new Cancelled();
		const repoDir = repo.path === "." ? path.join(dir, "Documents") : path.join(dir, "Documents", repo.path);
		try {
			const { stdout } = await run("git", ["-C", repoDir, "rev-parse", "HEAD"]);
			if (stdout.trim() !== repo.commit) {
				problems.push(`${repo.path} is at ${stdout.trim().slice(0, 7)}, the backup recorded ${repo.commit.slice(0, 7)}`);
			}
		} catch {
			problems.push(`${repo.path} was not restored as a repo`);
		}
		progress("commits", ++done, repos.length, "repos");
	}

	return { checked: repos.length, problems };
}

const list = (items) => `${items.slice(0, 5).join(", ")}${items.length > 5 ? ` and ${items.length - 5} more` : ""}`;

async function performDrill(trigger, backup, record) {
	const startedAt = new Date();
	const result = { trigger, startedAt: startedAt.toISOString(), backup: backup?.name ?? null, steps: [], checks: [] };
	const dir = path.join(scratchDir(), `drill-${startedAt.getTime()}`);

	const check = (label, ok, detail) => result.checks.push({ label, ok, detail });

	try {
		if (!backup) throw new Error("There is no valid backup to test");

		enter("prepare");
		await ensureImage();
		// Left over if a drill was cut off by a restart
		await run("docker", ["rm", "-f", CONTAINER]).catch(() => {});

		fs.mkdirSync(scratchDir(), { recursive: true, mode: 0o700 });
		for (const name of fs.readdirSync(scratchDir())) removeScratch(path.join(scratchDir(), name));

		const entries = await zipEntries(backup.path);
		const manifest = JSON.parse((await run("unzip", ["-p", backup.path, "bak/system/manifest.json"], { maxBuffer: 64 * 1024 * 1024 })).stdout);
		const sum = (prefix) => [...entries].reduce((total, [name, entry]) => (name.startsWith(prefix) ? total + entry.size : total), 0);
		const totals = {
			zipBytes: fs.statSync(backup.path).size,
			documentsBytes: sum("bak/documents/"),
			repos: (manifest.repos ?? []).filter((repo) => repo.remote || repo.bundle).length,
		};

		fs.mkdirSync(path.join(dir, "Documents"), { recursive: true, mode: 0o700 });
		// NTFS cannot hard link, so the ZIP is mounted read only onto a placeholder
		let zipMount = null;
		try {
			fs.linkSync(backup.path, path.join(dir, "Documents", backup.name));
		} catch {
			fs.writeFileSync(path.join(dir, "Documents", backup.name), "");
			zipMount = backup.path;
		}
		const skip = await stepsToSkip(backup.path);

		enter("test");
		const { code, steps } = await restoreInContainer(dir, backup.name, skip, totals, zipMount);
		if (running.cancelled) throw new Cancelled();

		result.steps = [...steps.values()].map(({ id, state, reason }) => ({ id, state, reason: reason ?? null }));
		const failedSteps = result.steps.filter((step) => step.state !== "ok");
		check(
			"restore.sh ran the restore steps",
			code === 0 && failedSteps.length === 0 && steps.size === RUN_STEPS.size,
			code !== 0
				? `It exited with code ${code}`
				: failedSteps.length
					? failedSteps.map((step) => `${step.id}: ${step.reason ?? step.state}`).join("; ")
					: steps.size < RUN_STEPS.size
						? `Only ${[...steps.keys()].join(", ")} ran`
						: `${[...steps.keys()].join(", ")} all passed`,
		);

		enter("files");
		const files = await verifyFiles(dir, entries);
		check(
			"Every file came back unchanged",
			files.missing.length === 0 && files.mismatched.length === 0,
			[
				`${files.checked.toLocaleString()} files checked against the ZIP`,
				files.missing.length ? `${files.missing.length} missing: ${list(files.missing)}` : null,
				files.mismatched.length ? `${files.mismatched.length} different: ${list(files.mismatched)}` : null,
			]
				.filter(Boolean)
				.join(". "),
		);

		enter("commits");
		const repos = await verifyRepos(dir, manifest);
		check(
			"Every repo is at the backed up commit",
			repos.problems.length === 0,
			repos.problems.length ? list(repos.problems) : `${repos.checked} ${repos.checked === 1 ? "repo" : "repos"} restored from the backup's own bundles`,
		);

		result.ok = result.checks.every((entry) => entry.ok);
		result.error = result.ok ? null : result.checks.find((entry) => !entry.ok).label.replace(/^Every/, "Not every");
	} catch (error) {
		if (error instanceof Cancelled || running.cancelled) {
			result.cancelled = true;
			result.ok = null;
			result.error = null;
		} else {
			result.ok = false;
			result.error = error.message;
		}
	}

	// Entered by hand, since enter() refuses after a cancel
	const now = new Date().toISOString();
	for (const entry of running.phases) {
		if (entry.state === "active") {
			entry.state = result.cancelled ? "cancelled" : result.ok === false ? "failed" : "done";
			entry.finishedAt = now;
		}
	}
	const cleanup = phase("cleanup");
	cleanup.state = "active";
	cleanup.startedAt = now;
	running.phase = cleanup.label;
	try {
		removeScratch(dir);
	} catch (error) {
		console.log(`Could not remove ${dir}: ${error.message}`);
	}
	cleanup.state = "done";
	cleanup.finishedAt = new Date().toISOString();

	const finishedAt = new Date();
	result.finishedAt = finishedAt.toISOString();
	result.durationMs = finishedAt - startedAt;
	result.phases = running.phases.map(({ id, state, startedAt: from, finishedAt: to }) => ({ id, state, startedAt: from ?? null, finishedAt: to ?? null }));
	result.log = running.log.slice(-25);

	if (!record) return result;

	const state = readState();
	state.results = [...state.results, result].slice(-KEEP_RESULTS);
	writeState(state);

	if (result.cancelled) {
		console.log("Restore drill cancelled");
		return result;
	}

	console.log(`Restore drill ${result.ok ? "passed" : `failed: ${result.error}`}`);
	sendBotNotification({
		title: result.ok ? "Restore drill passed" : "Restore drill failed",
		body: result.ok
			? `${backup.name} restored cleanly in a fresh container. ${result.checks.map((entry) => entry.detail).join(". ")}.`
			: `${result.backup ?? "The newest backup"} did not restore cleanly: ${result.error}. Details are on the server page.`,
	});
	return result;
}

// The options are for testing on a small ZIP without recording or notifying
export function startDrill(trigger = "manual", { backup = newestValidBackup(), record = true } = {}) {
	if (running) throw new Error("A restore drill is already running");
	if (backupRunning()) throw new Error("A backup is running, try again once it finishes");
	// Like after switching to an empty drive, which is not a failure
	if (!backup) throw new Error("There is no backup on this drive to test yet");

	running = {
		trigger,
		startedAt: new Date().toISOString(),
		backup: backup?.name ?? null,
		phase: "Starting",
		phases: PHASES.map(([id, label]) => ({ id, label, state: "pending", startedAt: null, finishedAt: null, progress: null })),
		log: [],
		inside: [],
		cancelled: false,
	};
	const job = performDrill(trigger, backup, record).finally(() => {
		running = null;
	});
	job.catch(() => {});
	return job;
}

export const drillRunning = () => Boolean(running);

// The checks stop at their next file, then the drill cleans up as cancelled
export function cancelDrill() {
	if (!running) throw new Error("No restore drill is running");
	if (running.cancelled) return;
	running.cancelled = true;
	running.phase = "Cancelling";
	run("docker", ["kill", CONTAINER]).catch(() => {});
}

// Two weeks after the last finished drill, with 12 hours of slack
function dueFrom(state = readState()) {
	const last = lastCompleted(state.results);
	return last ? new Date(last.startedAt).getTime() + EVERY - 12 * HOUR : (state.installedAt ?? Date.now());
}

function nextDue(now = Date.now()) {
	const due = new Date(Math.max(dueFrom(), now));
	if (due.getHours() > SCHEDULE_HOUR) due.setDate(due.getDate() + 1);
	due.setHours(SCHEDULE_HOUR, 0, 0, 0);
	return due.getTime();
}

// Feeds backup health. A failed or overdue drill is a problem, a cancel is not
export function getDrillHealth(now = Date.now()) {
	const state = readState();
	const last = lastCompleted(state.results);
	if (last && !last.ok) return { ok: false, reason: `The last restore drill failed: ${last.error}` };
	if (now > dueFrom(state) + 2 * DAY) {
		return {
			ok: false,
			reason: last
				? `No restore drill has finished since ${new Date(last.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
				: "No restore drill has run yet",
		};
	}
	return { ok: true, reason: null };
}

export function getDrillStatus() {
	const state = readState();
	return {
		running: running && {
			trigger: running.trigger,
			startedAt: running.startedAt,
			backup: running.backup,
			phase: running.phase,
			phases: running.phases,
			inside: running.inside,
			log: running.log.slice(-20),
			cancelled: running.cancelled,
		},
		last: state.results.at(-1) ?? null,
		lastCompleted: lastCompleted(state.results),
		nextScheduled: new Date(nextDue()).toISOString(),
		everyDays: EVERY / DAY,
	};
}

export function startDrillScheduler() {
	const state = readState();
	if (!state.installedAt) {
		state.installedAt = Date.now();
		writeState(state);
	}

	// One cancelled at 05:00 waits for the next morning
	const tick = () => {
		if (running || backupRunning()) return;
		const latest = readState().results.at(-1);
		if (latest && Date.now() - new Date(latest.startedAt).getTime() < 3 * HOUR) return;
		if (Date.now() >= dueFrom() && new Date().getHours() === SCHEDULE_HOUR) {
			try {
				startDrill("scheduled");
			} catch (error) {
				console.log(`Restore drill did not start: ${error.message}`);
			}
		}
	};
	setInterval(tick, 5 * 60 * 1000);
}
