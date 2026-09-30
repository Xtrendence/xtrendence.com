import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { localConfig } from "./localConfig.js";

const run = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DOCUMENTS = path.join(os.homedir(), "Documents");
export const BACKUP_DIR = localConfig().backups.dir;
const STATE_FILE = path.join(__dirname, "../data/backup-state.json");

const SCHEDULE_HOUR = 4;
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// A backup this close to the nightly slot counts as that night's
const POSTPONE_WINDOW = 2 * HOUR;
// Time a nightly run gets to start and finish before it counts as missed
const MISSED_GRACE = 3 * HOUR;
const RETRY_AFTER = HOUR;
const MAX_ATTEMPTS = 2;
const KEEP = 14;

// Only names this module creates are ever renamed or deleted
const BACKUP_NAME = /^documents-\d{4}-\d{2}-\d{2}_\d{4}-(nightly|manual)\.zip$/;
const LOCK_FILE = path.join(BACKUP_DIR, ".backup.lock");
const PARTIAL_NAME = /^documents-\d{4}-\d{2}-\d{2}_\d{4}-(nightly|manual)\.zip\.partial$/;

// Rebuilt by an install or a build, so not worth the space
const SKIP_DIRS = new Set([
	".git",
	"node_modules",
	".cache",
	"__pycache__",
	".venv",
	"venv",
	".next",
	".turbo",
	".parcel-cache",
	".svelte-kit",
	".pnpm-store",
	"coverage",
]);
// Only skipped when they sit next to a package.json, where they are build
// output. Elsewhere, like the bot's downloadable APK, they are kept
const BUILD_DIRS = new Set(["dist", "build"]);
const SKIP_FILES = new Set([".DS_Store"]);

// Already compressed, so zip stores them as they are
const STORED = ".jpg:.jpeg:.png:.gif:.webp:.heic:.mp4:.mov:.mkv:.mp3:.zip:.gz:.7z:.xz:.apk";

let running = null;
let schedulerStarted = false;

function readState() {
	try {
		const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
		return { attempts: [], ...state };
	} catch {
		return { attempts: [] };
	}
}

function writeState(state) {
	fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
	fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 4));
}

function stamp(date) {
	const pad = (value) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function slotOn(date) {
	const slot = new Date(date);
	slot.setHours(SCHEDULE_HOUR, 0, 0, 0);
	return slot.getTime();
}

function latestSlot(now = Date.now()) {
	const today = slotOn(new Date(now));
	return now >= today ? today : today - DAY;
}

function nextSlot(now = Date.now()) {
	return latestSlot(now) + DAY;
}

// Discovery

function isRepo(dir) {
	return fs.existsSync(path.join(dir, ".git"));
}

function isBuildOutput(dir) {
	return BUILD_DIRS.has(path.basename(dir)) && fs.existsSync(path.join(path.dirname(dir), "package.json"));
}

// Catches paths deeper inside build output, like dist/assets
function insideBuildOutput(full) {
	let dir = full;
	while (dir.startsWith(DOCUMENTS) && dir !== DOCUMENTS) {
		if (isBuildOutput(dir)) return true;
		dir = path.dirname(dir);
	}
	return false;
}

function skippedPath(relative) {
	return relative.split("/").some((segment) => SKIP_DIRS.has(segment));
}

// Symlinked directories are kept as links, never followed
function walk(dir, output) {
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name) || isBuildOutput(full) || isRepo(full)) continue;
			walk(full, output);
		} else if ((entry.isFile() || entry.isSymbolicLink()) && !SKIP_FILES.has(entry.name)) {
			output.push(full);
		}
	}
}

function findRepos(dir, output = []) {
	if (isRepo(dir)) output.push(dir);

	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return output;
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const full = path.join(dir, entry.name);
		if (SKIP_DIRS.has(entry.name) || isBuildOutput(full)) continue;
		findRepos(full, output);
	}

	return output;
}

async function gitList(repo, args) {
	const { stdout } = await run("git", ["-C", repo, "ls-files", "-z", ...args], {
		maxBuffer: 256 * 1024 * 1024,
	});
	return stdout.split("\0").filter(Boolean);
}

function sizeOf(files) {
	let bytes = 0;
	for (const file of files) {
		try {
			bytes += fs.lstatSync(file).size;
		} catch {}
	}
	return bytes;
}

// Everything in ~/Documents that git would not bring back: changes not yet
// committed, untracked files and ignored ones. Committed code is already on
// GitHub, so it is left out
export async function planBackup() {
	const repos = findRepos(DOCUMENTS);
	const files = new Set();
	const sources = [];

	for (const repo of repos) {
		const kinds = [
			["modified", ["-m"]],
			["untracked", ["-o", "--directory", "--exclude-standard"]],
			["ignored", ["-o", "-i", "--directory", "--exclude-standard"]],
		];

		for (const [kind, args] of kinds) {
			let entries;
			try {
				entries = await gitList(repo, args);
			} catch {
				continue;
			}

			for (const entry of entries) {
				if (skippedPath(entry)) continue;
				const full = path.join(repo, entry);
				if (insideBuildOutput(full.replace(/\/$/, ""))) continue;

				let found = [];
				if (entry.endsWith("/")) {
					const dir = full.replace(/\/$/, "");
					if (isRepo(dir) || isBuildOutput(dir)) continue;
					walk(dir, found);
				} else if (fs.existsSync(full) || fs.lstatSync(full, { throwIfNoEntry: false })) {
					if (SKIP_FILES.has(path.basename(full))) continue;
					found = [full];
				}

				const fresh = found.filter((file) => !files.has(file) && !file.includes("\n"));
				if (fresh.length === 0) continue;
				for (const file of fresh) files.add(file);

				sources.push({
					path: path.relative(DOCUMENTS, full),
					kind,
					repo: path.relative(DOCUMENTS, repo) || ".",
					files: fresh.length,
					bytes: sizeOf(fresh),
				});
			}
		}
	}

	const list = [...files].map((file) => path.relative(DOCUMENTS, file)).sort();

	// Git lists some ignored files one at a time, like every SMAHunter price
	// file, so single files are grouped under their folder for display
	const grouped = new Map();
	for (const source of sources) {
		const isFile = source.files === 1 && fs.lstatSync(path.join(DOCUMENTS, source.path), { throwIfNoEntry: false })?.isFile();
		const key = isFile ? path.dirname(source.path) : source.path;
		const group = grouped.get(key) ?? { path: key, kinds: new Set(), repo: source.repo, files: 0, bytes: 0, single: isFile ? source.path : null };
		group.kinds.add(source.kind);
		group.files += source.files;
		group.bytes += source.bytes;
		if (group.single && group.single !== source.path) group.single = null;
		grouped.set(key, group);
	}

	// A folder with just one backed up file shows that file's own path
	const groupedSources = [...grouped.values()]
		.map(({ kinds, single, ...group }) => ({
			...group,
			path: single ?? group.path,
			kind: [...kinds].join(", "),
		}))
		.sort((a, b) => b.bytes - a.bytes);

	return {
		files: list,
		sources: groupedSources,
		bytes: sources.reduce((sum, source) => sum + source.bytes, 0),
	};
}

// Running

function zipTo(target, files) {
	return new Promise((resolve, reject) => {
		const child = spawn(
			"nice",
			["-n", "19", "ionice", "-c3", "zip", "-q", "-y", "-n", STORED, "-@", target],
			{ cwd: DOCUMENTS },
		);

		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
			if (stderr.length > 64 * 1024) stderr = stderr.slice(-64 * 1024);
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ code, stderr }));

		child.stdin.on("error", () => {});
		child.stdin.end(`${files.join("\n")}\n`);
	});
}

async function countEntries(target) {
	const { stdout } = await run("zipinfo", ["-1", target], { maxBuffer: 512 * 1024 * 1024 });
	return stdout.split("\n").filter(Boolean).length;
}

function listBackups() {
	let names = [];
	try {
		names = fs.readdirSync(BACKUP_DIR).filter((name) => BACKUP_NAME.test(name));
	} catch {
		return [];
	}

	return names
		.map((name) => {
			const full = path.join(BACKUP_DIR, name);
			let manifest = null;
			try {
				manifest = JSON.parse(fs.readFileSync(`${full}.json`, "utf-8"));
			} catch {}
			const size = fs.statSync(full, { throwIfNoEntry: false })?.size ?? null;
			return {
				name,
				trigger: name.includes("-manual") ? "manual" : "nightly",
				startedAt: manifest?.startedAt ?? null,
				finishedAt: manifest?.finishedAt ?? null,
				fileCount: manifest?.fileCount ?? null,
				zipBytes: size,
				// A file that shrank or grew since it was tested is not trusted
				valid: Boolean(manifest?.verified) && size === manifest?.zipBytes,
				warnings: manifest?.warnings ?? [],
				sources: manifest?.sources ?? [],
			};
		})
		.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
}

// Only runs after a new backup has passed its test, and only touches names
// this module created
function prune() {
	const backups = listBackups();
	for (const backup of backups.slice(KEEP)) {
		const full = path.join(BACKUP_DIR, backup.name);
		fs.rmSync(full, { force: true });
		fs.rmSync(`${full}.json`, { force: true });
	}
}

function recordAttempt(attempt) {
	const state = readState();
	state.attempts = [...state.attempts, attempt].slice(-50);
	writeState(state);
}

async function performBackup(trigger) {
	const startedAt = new Date();
	const name = `documents-${stamp(startedAt)}-${trigger}.zip`;
	const target = path.join(BACKUP_DIR, name);
	const partial = `${target}.partial`;

	const attempt = { trigger, slot: latestSlot(startedAt.getTime()), startedAt: startedAt.toISOString(), name };

	try {
		running.phase = "Finding files";
		// The archives hold every .env and key, so only this user can read them
		fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
		fs.chmodSync(BACKUP_DIR, 0o700);

		const plan = await planBackup();
		running.files = plan.files.length;

		// Room for the whole set uncompressed, plus a margin
		const { bavail, bsize } = fs.statfsSync(BACKUP_DIR);
		const free = bavail * bsize;
		if (free < plan.bytes * 1.1 + 1024 ** 3) {
			throw new Error(`Not enough space on the backup drive, ${Math.round(free / 1024 ** 3)} GB free`);
		}

		running.phase = "Zipping";
		const { code, stderr } = await zipTo(partial, plan.files);
		fs.chmodSync(partial, 0o600);

		// 18 means some files vanished between listing and zipping, like a
		// log that rotated. Anything else is a real failure
		const warnings = [...stderr.matchAll(/zip warning: (.+)/g)].map((match) => match[1]).slice(0, 50);
		if (code !== 0 && code !== 18) {
			throw new Error(`zip exited with code ${code}${stderr ? `: ${stderr.trim().split("\n").pop()}` : ""}`);
		}

		running.phase = "Verifying";
		await run("unzip", ["-tqq", partial], { maxBuffer: 64 * 1024 * 1024 });
		const entries = await countEntries(partial);
		const expected = plan.files.length - (code === 18 ? warnings.length : 0);
		if (entries < expected) {
			throw new Error(`The archive holds ${entries} files, expected ${expected}`);
		}

		fs.renameSync(partial, target);
		fs.chmodSync(target, 0o600);
		const zipBytes = fs.statSync(target).size;
		const finishedAt = new Date();

		const manifest = {
			name,
			trigger,
			startedAt: attempt.startedAt,
			finishedAt: finishedAt.toISOString(),
			durationMs: finishedAt - startedAt,
			fileCount: entries,
			sourceBytes: plan.bytes,
			zipBytes,
			verified: true,
			warnings,
			sources: plan.sources,
		};
		fs.writeFileSync(`${target}.json`, JSON.stringify(manifest, null, 4), { mode: 0o600 });

		prune();

		recordAttempt({ ...attempt, finishedAt: manifest.finishedAt, ok: true });
		console.log(`Backup ${name} finished, ${entries} files, ${Math.round(zipBytes / 1024 ** 2)} MB`);
		return manifest;
	} catch (error) {
		// The partial is this run's own unfinished output, never an older backup
		fs.rmSync(partial, { force: true });
		recordAttempt({ ...attempt, finishedAt: new Date().toISOString(), ok: false, error: error.message });
		console.log(`Backup ${name} failed: ${error.message}`);
		throw error;
	}
}

// Held for the whole run, so a second process, like a dev server on the same
// machine, can never start a backup alongside this one
function takeLock() {
	fs.mkdirSync(BACKUP_DIR, { recursive: true });
	try {
		const held = JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8"));
		try {
			process.kill(held.pid, 0);
			return false;
		} catch {
			// The process that held it is gone, so the lock is stale
		}
	} catch {}
	fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
	return true;
}

function releaseLock() {
	try {
		const held = JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8"));
		if (held.pid === process.pid) fs.rmSync(LOCK_FILE, { force: true });
	} catch {}
}

export function startBackup(trigger = "manual") {
	if (running) {
		throw new Error("A backup is already running");
	}
	if (!takeLock()) {
		throw new Error("A backup is already running in another process");
	}

	running = { trigger, startedAt: new Date().toISOString(), phase: "Starting", files: null };
	const job = performBackup(trigger).finally(() => {
		running = null;
		releaseLock();
	});
	job.catch(() => {});
	return job;
}

// Scheduling

function successes() {
	return readState()
		.attempts.filter((attempt) => attempt.ok)
		.map((attempt) => new Date(attempt.startedAt).getTime());
}

// A slot is covered by any good backup from two hours before it up to two
// hours before the next one, so a manual run just before 04:00 postpones
function slotCovered(slot, times = successes()) {
	return times.some((time) => time >= slot - POSTPONE_WINDOW && time < slot + DAY - POSTPONE_WINDOW);
}

function attemptsFor(slot) {
	return readState().attempts.filter((attempt) => attempt.trigger === "nightly" && attempt.slot === slot);
}

function tick() {
	if (running) return;

	const now = Date.now();
	const slot = latestSlot(now);
	const state = readState();

	// Nothing is owed for slots from before this was installed
	if (state.installedAt && new Date(state.installedAt).getTime() > slot) return;
	if (slotCovered(slot)) return;
	// A slot this old is reported as missed rather than caught up on
	if (now - slot > DAY - POSTPONE_WINDOW) return;

	const attempts = attemptsFor(slot);
	if (attempts.length >= MAX_ATTEMPTS) return;
	const last = attempts.at(-1);
	if (last && now - new Date(last.finishedAt).getTime() < RETRY_AFTER) return;

	// Throws straight away when another process holds the lock, which must
	// not escape the interval and take the website down with it
	try {
		startBackup("nightly").catch(() => {});
	} catch (error) {
		console.log(`Nightly backup did not start: ${error.message}`);
	}
}

export function startBackupScheduler() {
	if (schedulerStarted) return;
	schedulerStarted = true;

	const state = readState();
	if (!state.installedAt) {
		writeState({ ...state, installedAt: new Date().toISOString() });
	}

	// A run cut short by a restart leaves its partial behind. Cleared only
	// when no other process holds the lock, so a live run is never touched
	try {
		if (!takeLock()) throw new Error("locked");
		for (const name of fs.readdirSync(BACKUP_DIR)) {
			if (PARTIAL_NAME.test(name)) fs.rmSync(path.join(BACKUP_DIR, name), { force: true });
		}
		releaseLock();
	} catch {}

	setTimeout(tick, 60 * 1000);
	setInterval(tick, 60 * 1000);
}

// Health, for the dashboard and the alert rule

export function getBackupHealth(now = Date.now()) {
	const state = readState();
	const backups = listBackups();
	const times = successes();

	const last = state.attempts.at(-1);
	if (last && !last.ok) {
		return { ok: false, reason: `The last backup failed: ${last.error}` };
	}

	const newest = backups[0];
	if (newest && !newest.valid) {
		return { ok: false, reason: `${newest.name} is missing, changed or failed its test` };
	}

	const broken = backups.filter((backup) => !backup.valid);
	if (broken.length) {
		return { ok: false, reason: `${broken.length} older backup${broken.length === 1 ? "" : "s"} failed the size check` };
	}

	// The slot being judged is the latest one that has had time to finish
	let slot = latestSlot(now);
	if (now < slot + MISSED_GRACE) slot -= DAY;

	const installed = state.installedAt ? new Date(state.installedAt).getTime() : now;
	if (slot >= installed - POSTPONE_WINDOW && !slotCovered(slot, times)) {
		const date = new Date(slot).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
		return { ok: false, reason: `The nightly backup for ${date} did not happen` };
	}

	return { ok: true, reason: null };
}

function lockedElsewhere() {
	try {
		const held = JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8"));
		if (held.pid === process.pid) return null;
		process.kill(held.pid, 0);
		return { trigger: "manual", startedAt: held.at, phase: "Running in another process", files: null };
	} catch {
		return null;
	}
}

export function getBackupStatus() {
	const now = Date.now();
	const next = nextSlot(now);
	const current = latestSlot(now);
	const installed = new Date(readState().installedAt ?? now).getTime();
	const backups = listBackups();

	// A slot that is owed and still catchable runs now, otherwise the next
	// one does, unless a manual run has already covered it
	const owed =
		current >= installed &&
		!slotCovered(current) &&
		now - current <= DAY - POSTPONE_WINDOW &&
		attemptsFor(current).length < MAX_ATTEMPTS;
	let upcoming = owed ? current : next;
	if (slotCovered(upcoming)) upcoming += DAY;

	return {
		health: getBackupHealth(now),
		running: running ?? lockedElsewhere(),
		backups: backups.map(({ sources, ...backup }) => backup),
		latestSources: backups[0]?.sources ?? [],
		lastAttempt: readState().attempts.at(-1) ?? null,
		nextScheduled: new Date(upcoming).toISOString(),
		// A run started now would cover the coming slot and skip it
		postponesNext: now >= next - POSTPONE_WINDOW && !slotCovered(next),
		destination: BACKUP_DIR,
		driveLabel: localConfig().backups.driveLabel,
		keep: KEEP,
	};
}
