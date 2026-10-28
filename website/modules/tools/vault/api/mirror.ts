import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { TMirrorRun, TMirrorStats, TMirrorStatus } from "../shared/protocol";
import { STATE } from "./config";

// Mirrors the encrypted vault folder to the 12TB drive, the only deletes are rsync's --delete-after into DEST

const STATE_FILE = path.join(STATE, "mirror.json");

// Fixed on purpose, nothing about these paths comes from settings, the environment or requests
const SOURCE_DRIVE = "/media/Seagate";
const SOURCE = "/media/Seagate/Vault/";
const SOURCE_MARKER = "/media/Seagate/Vault/cipher/gocryptfs.conf";
const DEST_DRIVE = "/media/12TB";
const DEST = "/media/12TB/Vault Backup/";

const RSYNC = "/usr/bin/rsync";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const EVERY = 8 * HOUR;
// A full checksum pass reads every file on both drives, so it runs weekly and the rest compare size and time
const CHECKSUM_EVERY = 7 * DAY;
// More deletes than this waits for approval
const DELETE_SHARE = 0.05;
const DELETE_MIN = 200;
const KEEP_RESULTS = 30;

type TState = { results: TMirrorRun[]; installedAt?: number };
type TRunning = NonNullable<TMirrorStatus["running"]> & { child: ChildProcess | null };

class Cancelled extends Error {}

function readState(): TState {
	try {
		return { results: [], ...JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) };
	} catch {
		return { results: [] };
	}
}

function writeState(state: TState) {
	const temp = `${STATE_FILE}.tmp`;
	fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
	fs.renameSync(temp, STATE_FILE);
}

const lastCompleted = (results: TMirrorRun[]) => results.filter((result) => !result.cancelled).at(-1) ?? null;
const lastSuccess = (results: TMirrorRun[]) => results.filter((result) => result.ok).at(-1) ?? null;
const lastChecksum = (results: TMirrorRun[]) => results.filter((result) => result.ok && result.checksum).at(-1) ?? null;

// An empty folder where a drive should be mounted shares its parent's device
function isMountPoint(dir: string) {
	try {
		return fs.statSync(dir).dev !== fs.statSync(path.dirname(dir)).dev;
	} catch {
		return false;
	}
}

// Paths are compared to the literals again right before rsync runs, so a refactor can never point --delete elsewhere
function rsyncArgs(options: string[]) {
	const args = ["-a", "-x", "--no-inc-recursive", "--stats", ...options, SOURCE, DEST];
	const [source, dest] = args.slice(-2);
	if (source !== "/media/Seagate/Vault/" || dest !== "/media/12TB/Vault Backup/") {
		throw new Error("Refusing to run rsync, the mirror paths are not the expected ones");
	}
	return args;
}

const number = (text: string) => Number(text.replace(/,/g, ""));

function parseStats(output: string): TMirrorStats {
	const field = (label: string) => {
		const match = output.match(new RegExp(`^${label}: ([\\d,]+)`, "m"));
		return match ? number(match[1]) : 0;
	};
	const regular = output.match(/^Number of files: [\d,]+ \(reg: ([\d,]+)/m);
	return {
		files: field("Number of files"),
		regular: regular ? number(regular[1]) : 0,
		created: field("Number of created files"),
		deleted: field("Number of deleted files"),
		transferred: field("Number of regular files transferred"),
		totalBytes: field("Total file size"),
		transferredBytes: field("Total transferred file size"),
	};
}

const lastLine = (text: string) =>
	text
		.trim()
		.split("\n")
		.filter((line) => line.trim())
		.at(-1)
		?.replace(/^rsync: /, "")
		.slice(0, 300) ?? "";

// Another rsync into the backup, like one left by an older version of this job, would fight over the same files
function otherRsync(own: number | undefined) {
	for (const pid of fs.readdirSync("/proc")) {
		if (!/^\d+$/.test(pid) || Number(pid) === own) {
			continue;
		}
		try {
			const args = fs.readFileSync(`/proc/${pid}/cmdline`, "utf-8").split("\0");
			if (args[0].endsWith("rsync") && args.includes(DEST)) {
				return true;
			}
		} catch {}
	}
	return false;
}

function deleteLimit(stats: TMirrorStats) {
	// What the backup holds now, the source's files minus those it lacks plus those it would lose
	const backupFiles = Math.max(0, stats.files - stats.created + stats.deleted);
	return Math.max(DELETE_MIN, Math.floor(backupFiles * DELETE_SHARE));
}

export class Mirror {
	private running: TRunning | null = null;

	private rsync(options: string[], onLine?: (line: string) => void) {
		const args = rsyncArgs(options);
		return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
			const child = spawn(RSYNC, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LC_ALL: "C" } });
			if (this.running) {
				this.running.child = child;
			}
			let stdout = "";
			let stderr = "";
			let partial = "";
			child.stdout.on("data", (chunk: Buffer) => {
				const text = chunk.toString();
				stdout = (stdout + text).slice(-64 * 1024);
				if (!onLine) {
					return;
				}
				// Progress lines end in carriage returns, the rest in newlines
				const lines = (partial + text).split(/[\r\n]/);
				partial = lines.pop() ?? "";
				for (const line of lines) {
					if (line.trim()) {
						onLine(line);
					}
				}
			});
			child.stderr.on("data", (chunk: Buffer) => {
				stderr = (stderr + chunk.toString()).slice(-16 * 1024);
			});
			child.on("error", reject);
			child.on("close", (code) => {
				if (this.running?.child === child) {
					this.running.child = null;
				}
				resolve({ code, stdout, stderr });
			});
		});
	}

	private preflight() {
		if (!isMountPoint(SOURCE_DRIVE)) {
			throw new Error(`${SOURCE_DRIVE} is not mounted`);
		}
		if (!isMountPoint(DEST_DRIVE)) {
			throw new Error(`${DEST_DRIVE} is not mounted`);
		}
		// The vault's own config proves the source is the real vault and not an empty folder
		if (!fs.existsSync(SOURCE_MARKER)) {
			throw new Error("The vault folder is missing its gocryptfs.conf");
		}
		fs.mkdirSync(DEST, { recursive: true, mode: 0o700 });
		const dest = fs.lstatSync(DEST.slice(0, -1));
		if (!dest.isDirectory() || dest.isSymbolicLink()) {
			throw new Error(`${DEST} is not a folder`);
		}
		if (otherRsync(process.pid)) {
			throw new Error("Another rsync is already copying into the backup");
		}
	}

	private async perform(running: TRunning, approved: number | null): Promise<TMirrorRun> {
		const results = readState().results;
		// rsync checksums every source file before copying anything, so a first sync into an empty backup never does it
		const since = lastChecksum(results)?.startedAt ?? lastSuccess(results)?.startedAt;
		const checksum = running.trigger === "checksum" || (since !== undefined && Date.now() - since > CHECKSUM_EVERY);
		running.checksum = checksum;
		const result: TMirrorRun = { trigger: running.trigger, startedAt: running.startedAt, finishedAt: 0, ok: false, checksum, error: null, held: null, stats: null };

		try {
			running.phase = "Checking the drives";
			this.preflight();

			// A rehearsal first, nothing is written or deleted, and deletes don't depend on checksums so it skips them
			running.phase = "Comparing";
			const plan = await this.rsync(["--delete-after", "--dry-run"]);
			if (running.cancelled) {
				throw new Cancelled();
			}
			if (plan.code !== 0 && plan.code !== 24) {
				throw new Error(`The dry run failed (${plan.code}): ${lastLine(plan.stderr)}`);
			}
			const planned = parseStats(plan.stdout);
			// A real vault always has at least gocryptfs.conf and the root's gocryptfs.diriv
			if (planned.regular < 2) {
				throw new Error("The dry run saw almost no files in the vault folder, nothing was changed");
			}

			const limit = deleteLimit(planned);
			const allowed = Math.max(limit, approved ?? 0);
			if (planned.deleted > allowed) {
				result.held = { deletes: planned.deleted, limit };
				result.error = `Waiting for approval to delete ${planned.deleted.toLocaleString("en-GB")} files from the backup`;
				return result;
			}

			running.phase = checksum ? "Comparing checksums" : planned.transferred ? "Copying" : "Finishing";
			running.plan = { files: planned.transferred, bytes: planned.transferredBytes, deletes: planned.deleted };
			const sync = await this.rsync(["--delete-after", `--max-delete=${allowed}`, "--info=progress2", ...(checksum ? ["--checksum"] : [])], (line) => {
				const match = line.match(/^\s*([\d,]+)\s+(\d+)%\s+(\S+)\s+(\d+:\d{2}:\d{2})/);
				if (match) {
					running.progress = { bytes: number(match[1]), percent: Number(match[2]), rate: match[3], eta: match[4] };
					if (checksum) {
						running.phase = "Copying";
					}
				}
			});
			if (running.cancelled) {
				throw new Cancelled();
			}
			result.stats = parseStats(sync.stdout);
			if (sync.code === 25) {
				throw new Error("rsync stopped deleting at the allowed limit, nothing past it was removed");
			}
			// Files gocryptfs replaced mid-run are picked up next time
			if (sync.code !== 0 && sync.code !== 24) {
				throw new Error(`rsync failed (${sync.code}): ${lastLine(sync.stderr)}`);
			}
			result.ok = true;
		} catch (error) {
			if (error instanceof Cancelled || running.cancelled) {
				result.cancelled = true;
				result.ok = null;
			} else {
				result.error = error instanceof Error ? error.message : String(error);
			}
		}
		return result;
	}

	// approve is the delete count the user saw, a bigger one is held again
	start(trigger: TMirrorRun["trigger"], approve: number | null = null) {
		if (this.running) {
			throw new Error("The vault mirror is already running");
		}
		const running: TRunning = { trigger, startedAt: Date.now(), phase: "Starting", checksum: false, cancelled: false, progress: null, plan: null, child: null };
		this.running = running;
		const approved = Number.isInteger(approve) && (approve as number) > 0 ? approve : null;
		void this.perform(running, approved)
			.then((result) => {
				result.finishedAt = Date.now();
				const state = readState();
				state.results = [...state.results, result].slice(-KEEP_RESULTS);
				writeState(state);
				console.log(result.cancelled ? "Vault mirror cancelled" : `Vault mirror ${result.ok ? "synced" : `failed: ${result.error}`}`);
			})
			.catch((error) => console.error("Vault mirror crashed", error))
			.finally(() => {
				this.running = null;
			});
	}

	// rsync stops on SIGTERM and leaves only finished files behind
	cancel() {
		if (!this.running) {
			throw new Error("The vault mirror is not running");
		}
		this.running.cancelled = true;
		this.running.phase = "Cancelling";
		this.running.child?.kill("SIGTERM");
	}

	stop() {
		if (this.running) {
			this.running.cancelled = true;
			this.running.child?.kill("SIGTERM");
		}
	}

	private nextDue(state: TState, now = Date.now()) {
		const last = lastCompleted(state.results);
		return Math.max(last ? last.startedAt + EVERY : (state.installedAt ?? now), now);
	}

	// A held sync or a failure is a problem, as is no successful sync for two rounds
	private health(state: TState, now = Date.now()) {
		const last = lastCompleted(state.results);
		if (last?.held) {
			return { ok: false, reason: last.error };
		}
		if (last && !last.ok) {
			return { ok: false, reason: `The vault backup failed: ${last.error}` };
		}
		const since = lastSuccess(state.results)?.startedAt ?? state.installedAt ?? now;
		if (now - since > 2 * EVERY + HOUR && !this.running) {
			return { ok: false, reason: lastSuccess(state.results) ? "The vault backup has not synced for over 17 hours" : "The vault backup has not synced yet" };
		}
		return { ok: true, reason: null };
	}

	status(): TMirrorStatus {
		const state = readState();
		const last = lastCompleted(state.results);
		const running = this.running;
		return {
			running: running && {
				trigger: running.trigger,
				startedAt: running.startedAt,
				phase: running.phase,
				checksum: running.checksum,
				cancelled: running.cancelled,
				progress: running.progress,
				plan: running.plan,
			},
			last: state.results.at(-1) ?? null,
			lastCompleted: last,
			lastSuccess: lastSuccess(state.results),
			lastChecksum: lastChecksum(state.results)?.startedAt ?? null,
			held: last?.held ?? null,
			nextScheduled: this.nextDue(state),
			everyHours: EVERY / HOUR,
			health: this.health(state),
			source: SOURCE,
			dest: DEST,
		};
	}

	// A held sync only rehearses again, nothing changes until it is approved
	startScheduler() {
		const state = readState();
		if (!state.installedAt) {
			state.installedAt = Date.now();
			writeState(state);
		}
		const tick = () => {
			if (this.running || Date.now() < this.nextDue(readState())) {
				return;
			}
			try {
				this.start("scheduled");
			} catch (error) {
				console.log(`Vault mirror did not start: ${(error as Error).message}`);
			}
		};
		setTimeout(tick, 60 * 1000).unref();
		setInterval(tick, 5 * 60 * 1000).unref();
	}
}
