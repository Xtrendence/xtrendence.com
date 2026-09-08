import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dirArg = args.find((arg) => arg.startsWith("--dir="));

const LOG_DIR = dirArg
	? path.resolve(dirArg.slice("--dir=".length))
	: path.join(os.homedir(), ".pm2", "logs");

const MAX_AGE_DAYS = 30;
const GB = 1024 ** 3;
const MB = 1024 ** 2;

// Past this size a file is deleted outright rather than rewritten
const DELETE_ABOVE = 5 * GB;

// Files below this are left alone, there is nothing worth reclaiming
const IGNORE_BELOW = 1 * MB;

// pm2 only writes per line timestamps when an app is started with --time. For
// files without them, age cannot be judged per line, so the newest slice is
// kept instead.
const UNDATED_KEEP = 64 * MB;

const COPY_CHUNK = 8 * MB;
const SCAN_CHUNK = 4 * MB;
const NEWLINE = 0x0a;

// Only the start of a line can hold a timestamp, so that is all that is read
// out of it. Keeps memory flat even if a single line is enormous.
const HEAD_BYTES = 32;

const OWN_LOG = path.join(__dirname, "cleaner.log");
const OWN_LOG_LINES = 500;

const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const lines = [];

function report(message) {
	lines.push(message);
	console.log(dryRun ? `[dry run] ${message}` : message);
}

function human(bytes) {
	if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
	if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
	return `${(bytes / 1024).toFixed(0)} KB`;
}

// Matches the prefix pm2 writes with --time, e.g. "2026-09-08T09:49:12: msg"
function parseStamp(line) {
	const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(line);
	if (!match) return null;
	const time = Date.parse(`${match[1]}T${match[2]}`);
	return Number.isNaN(time) ? null : time;
}

// Byte offset of the first line stamped at or after the cutoff. Lines with no
// stamp of their own belong to the stamp above them, so starting the copy at a
// stamped line keeps its continuation lines with it.
function findCutoffOffset(fd, size) {
	const buffer = Buffer.allocUnsafe(SCAN_CHUNK);
	let position = 0;
	let lineStart = 0;
	let head = "";
	let sawStamp = false;

	while (position < size) {
		const read = fs.readSync(fd, buffer, {
			offset: 0,
			position,
			length: Math.min(SCAN_CHUNK, size - position),
		});

		if (read <= 0) break;

		let consumed = 0;

		while (consumed < read) {
			const index = buffer.indexOf(NEWLINE, consumed);
			const end = index === -1 || index >= read ? -1 : index;
			const readTo = end === -1 ? read : end;

			if (head.length < HEAD_BYTES) {
				head += buffer.toString(
					"utf8",
					consumed,
					Math.min(readTo, consumed + HEAD_BYTES),
				);
			}

			if (end === -1) break;

			const stamp = parseStamp(head);

			if (stamp !== null) {
				sawStamp = true;
				if (stamp >= cutoff) {
					return { offset: lineStart, sawStamp: true };
				}
			}

			consumed = end + 1;
			lineStart = position + consumed;
			head = "";
		}

		position += read;
	}

	// Trailing line with no newline of its own
	const last = parseStamp(head);

	if (last !== null) {
		sawStamp = true;
		if (last >= cutoff) {
			return { offset: lineStart, sawStamp: true };
		}
	}

	// Every stamp predates the cutoff, so nothing is worth keeping
	return { offset: sawStamp ? size : null, sawStamp };
}

// First line boundary at or after `from`, so a trimmed file never opens mid
// line. Falls back to `from` when the tail holds no newline at all, since
// keeping a partial line beats discarding the newest output.
function nextLineStart(fd, size, from) {
	const buffer = Buffer.allocUnsafe(SCAN_CHUNK);
	let position = from;

	while (position < size) {
		const read = fs.readSync(fd, buffer, {
			offset: 0,
			position,
			length: Math.min(SCAN_CHUNK, size - position),
		});

		if (read <= 0) break;

		const index = buffer.indexOf(NEWLINE);

		if (index !== -1 && index < read) {
			return position + index + 1;
		}

		position += read;
	}

	return from;
}

// Copies [from, size) into a sibling temp file and renames it over the
// original. pm2 holds an open handle at the old write offset, so reloadLogs has
// to run afterwards for it to pick the new file up.
function keepFrom(file, fd, size, from) {
	const temp = `${file}.trim-${process.pid}`;
	const mode = fs.fstatSync(fd).mode;
	const out = fs.openSync(temp, "w", mode);
	const buffer = Buffer.allocUnsafe(COPY_CHUNK);
	let position = from;

	try {
		while (position < size) {
			const read = fs.readSync(fd, buffer, {
				offset: 0,
				position,
				length: Math.min(COPY_CHUNK, size - position),
			});

			if (read <= 0) break;

			fs.writeSync(out, buffer, 0, read);
			position += read;
		}

		fs.fsyncSync(out);
	} finally {
		fs.closeSync(out);
	}

	fs.renameSync(temp, file);
}

function clean(file) {
	const stats = fs.statSync(file);
	const size = stats.size;

	if (size > DELETE_ABOVE) {
		if (!dryRun) fs.rmSync(file);
		report(
			`deleted ${path.basename(file)} (${human(size)}, over the ${human(DELETE_ABOVE)} limit)`,
		);
		return true;
	}

	if (size < IGNORE_BELOW) {
		return false;
	}

	// A file untouched since the cutoff is old in its entirety, no need to read it
	if (stats.mtimeMs < cutoff) {
		if (!dryRun) fs.truncateSync(file, 0);
		report(
			`emptied ${path.basename(file)} (${human(size)}, untouched since ${stats.mtime.toISOString().split("T")[0]})`,
		);
		return true;
	}

	const fd = fs.openSync(file, "r");

	try {
		const { offset, sawStamp } = findCutoffOffset(fd, size);

		if (sawStamp) {
			if (offset === 0) return false;

			if (!dryRun) keepFrom(file, fd, size, offset);
			report(
				`trimmed ${path.basename(file)} ${human(size)} -> ${human(size - offset)} (dropped lines older than ${MAX_AGE_DAYS} days)`,
			);
			return true;
		}

		if (size <= UNDATED_KEEP) {
			return false;
		}

		const from = nextLineStart(fd, size, size - UNDATED_KEEP);
		if (!dryRun) keepFrom(file, fd, size, from);
		report(
			`trimmed ${path.basename(file)} ${human(size)} -> ${human(size - from)} (no timestamps, kept the newest ${human(UNDATED_KEEP)})`,
		);
		return true;
	} finally {
		fs.closeSync(fd);
	}
}

// Under cron, PATH holds neither pm2 nor node, and the pm2 shebang is
// "env node". Running it through this process's own node, with its bin
// directory on PATH, makes it work in both environments.
function reloadPm2Logs() {
	const bin = path.dirname(process.execPath);
	const pm2 = path.join(bin, "pm2");
	const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` };

	if (fs.existsSync(pm2)) {
		execFileSync(process.execPath, [pm2, "reloadLogs"], {
			stdio: "ignore",
			env,
		});
		return;
	}

	execFileSync("pm2", ["reloadLogs"], { stdio: "ignore", env });
}

function writeOwnLog() {
	if (lines.length === 0 || dryRun) return;

	const stamp = new Date().toISOString();
	const entry = lines.map((line) => `${stamp} ${line}`);
	const existing = fs.existsSync(OWN_LOG)
		? fs.readFileSync(OWN_LOG, "utf-8").split("\n").filter(Boolean)
		: [];

	const kept = [...existing, ...entry].slice(-OWN_LOG_LINES);
	fs.writeFileSync(OWN_LOG, `${kept.join("\n")}\n`);
}

try {
	if (!fs.existsSync(LOG_DIR)) {
		process.exit(0);
	}

	const files = fs
		.readdirSync(LOG_DIR)
		.filter((name) => name.endsWith(".log"))
		.map((name) => path.join(LOG_DIR, name));

	let changed = 0;

	for (const file of files) {
		try {
			if (clean(file)) changed += 1;
		} catch (error) {
			report(`failed on ${path.basename(file)}: ${error.message}`);
		}
	}

	if (changed > 0 && !dryRun) {
		// pm2 keeps writing to the replaced file until it reopens its handles,
		// which would leave the freed space unreclaimed
		try {
			reloadPm2Logs();
			report(`reloaded pm2 log handles after ${changed} change(s)`);
		} catch (error) {
			report(`pm2 reloadLogs failed: ${error.message}`);
		}
	}

	writeOwnLog();
} catch (error) {
	report(`log cleaner failed: ${error.message}`);
	writeOwnLog();
	process.exit(1);
}
