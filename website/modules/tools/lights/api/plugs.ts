import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { TPlugConfig, TPlugStatus, TQuietRange } from "../shared/types";

// Smart plugs switched off for a moment and back on at a set interval

const run = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const plugsFile = path.join(__dirname, "plugs.txt");
const stateFile = path.join(__dirname, "plugs-state.json");

const OFF_FOR = 10 * 1000;
const TICK = 60 * 1000;
const ON_ATTEMPTS = 6;
const STATUS_TTL = 60 * 1000;

export const MIN_HOURS = 0.25;
export const MAX_HOURS = 720;

// How far outside quiet hours a moved restart lands
const QUIET_MARGIN = 5 * 60 * 1000;
const MAX_QUIET_RANGES = 12;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

// IPs end up as arguments to plug.py, so only plain hostnames and IPv4 pass
const hostPattern =
	/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i;

type TPlugState = {
	firstSeenAt?: number;
	lastCycleAt?: number;
	lastAttemptAt?: number;
	lastResult?: "ok" | "failed";
	lastError?: string | null;
	// A restart that did not finish, so on keeps being sent until it answers
	pendingOn?: boolean;
};

const busy = new Set<number>();
const live = new Map<number, { at: number; online: boolean }>();

export function getPlugs(): TPlugConfig[] {
	if (!existsSync(plugsFile)) {
		return [];
	}
	try {
		const plugs = JSON.parse(readFileSync(plugsFile, "utf-8") || "[]");
		return Array.isArray(plugs) ? plugs : [];
	} catch (_) {
		return [];
	}
}

export function savePlugs(plugs: TPlugConfig[]) {
	writeFileSync(plugsFile, JSON.stringify(plugs, null, 4));
	// Removed plugs lose their schedule, so re-adding one starts it afresh
	const state = readState();
	for (const id of Object.keys(state)) {
		if (!plugs.some((plug) => plug.id === Number(id))) {
			delete state[Number(id)];
		}
	}
	writeState(state);
	for (const id of [...live.keys()]) {
		if (!plugs.some((plug) => plug.id === id)) {
			live.delete(id);
		}
	}
}

function readState(): Record<number, TPlugState> {
	try {
		return JSON.parse(readFileSync(stateFile, "utf-8") || "{}");
	} catch (_) {
		return {};
	}
}

function writeState(state: Record<number, TPlugState>) {
	writeFileSync(stateFile, JSON.stringify(state, null, 4));
}

function updateState(id: number, patch: TPlugState) {
	const state = readState();
	state[id] = { ...state[id], ...patch };
	writeState(state);
}

// tapo handles the TPAP login kasa cannot
const PLUG_SCRIPT = path.join(__dirname, "plug.py");
const UV = path.join(process.env.HOME ?? "", ".local", "bin", "uv");
const TAPO_VERSION = "0.11.1";

type TPlugReply = { on?: boolean; step?: string; error?: string };

// Turns a failed command into something a person can act on
function explain(text: string) {
	if (/TPAP_CREDENTIALS|Unauthorized|password/i.test(text)) {
		return "The plug refused the login. Check TP_EMAIL and TP_PASSWORD in api/.env match the Tapo account. It locks itself after too many failed logins.";
	}
	if (/timed out|timeout|connect|unreachable|No route/i.test(text)) {
		return "The plug did not answer the command";
	}
	return (
		text
			.split("\n")
			.find((line) => line.trim())
			?.slice(0, 200) ?? "Unknown error"
	);
}

// Keeps output on failure, since a restart can cut the network
async function tapo(ip: string, ...args: string[]) {
	const result = await run(
		UV,
		[
			"run",
			"--quiet",
			"--no-project",
			"--python",
			"3.12",
			"--with",
			`tapo==${TAPO_VERSION}`,
			"python",
			PLUG_SCRIPT,
			args[0],
			ip,
			...args.slice(1),
		],
		// The account details reach plug.py through the environment it inherits
		{ timeout: 60000, maxBuffer: 1024 * 1024 },
	).catch((error) => ({
		stdout: String(error?.stdout ?? ""),
		stderr: String(error?.stderr ?? error?.message ?? ""),
	}));

	const replies: TPlugReply[] = [];
	for (const line of String(result.stdout).split("\n")) {
		try {
			replies.push(JSON.parse(line));
		} catch (_) {}
	}
	const error =
		replies.find((reply) => reply.error)?.error ??
		(replies.length ? null : String(result.stderr) || "No answer from plug.py");
	return { replies, error };
}

async function isOn(ip: string) {
	const { replies, error } = await tapo(ip, "state");
	if (error) {
		throw new Error(error);
	}
	return replies.find((reply) => typeof reply.on === "boolean")?.on ?? null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A plug counts as there when its own web page answers with 200
async function answers(ip: string) {
	try {
		const response = await fetch(`http://${ip}/`, {
			signal: AbortSignal.timeout(5000),
		});
		return response.status === 200;
	} catch (_) {
		return false;
	}
}

async function waitForAnswer(ip: string, tries: number) {
	for (let attempt = 0; attempt < tries; attempt++) {
		if (await answers(ip)) {
			return true;
		}
		await sleep(5000);
	}
	return false;
}

// The only retried command. A plug already on is left alone
async function switchOn(plug: TPlugConfig) {
	let lastError: string | null = null;
	for (let attempt = 1; attempt <= ON_ATTEMPTS; attempt++) {
		try {
			if ((await isOn(plug.ip)) === true) {
				return null;
			}
			const { error } = await tapo(plug.ip, "on");
			if (!error && (await isOn(plug.ip)) === true) {
				return null;
			}
			lastError = error ?? "It did not switch on";
		} catch (error) {
			lastError = String((error as Error)?.message ?? error);
		}
		await sleep(10000);
	}
	return lastError;
}

// The plug's own timer turns it back on, even if it powers the router
export async function cyclePlug(plug: TPlugConfig) {
	if (busy.has(plug.id)) {
		return { ok: false, error: "Already restarting" };
	}
	busy.add(plug.id);
	const startedAt = Date.now();
	updateState(plug.id, { lastAttemptAt: startedAt });

	// Only a failure after switching off keeps retrying on
	const fail = (message: string, pendingOn: boolean) => {
		updateState(plug.id, {
			...(pendingOn ? {} : { lastCycleAt: startedAt }),
			lastResult: "failed",
			lastError: message,
			pendingOn,
		});
		console.log(`Plug ${plug.name} (${plug.ip}): ${message}`);
		return { ok: false, error: message };
	};

	try {
		if (!(await answers(plug.ip))) {
			return fail(`Not answering at ${plug.ip}, so nothing was sent`, false);
		}

		updateState(plug.id, { pendingOn: true });
		const { replies, error } = await tapo(
			plug.ip,
			"restart",
			String(OFF_FOR / 1000),
		);
		const timerSet = replies.some((reply) => reply.step === "timer");
		if (!timerSet) {
			// Without the timer nothing was switched off, so the plug is still on
			return fail(`The restart did not start: ${explain(error ?? "")}`, false);
		}

		// Five minutes for a router to come back
		await sleep(OFF_FOR);
		if (!(await waitForAnswer(plug.ip, 60))) {
			return fail(
				"It has not answered since switching off. If it powers the router, the router may still be starting",
				true,
			);
		}

		const onError = await switchOn(plug);
		if (onError) {
			return fail(
				`Back on the network but not confirmed on: ${explain(onError)}`,
				true,
			);
		}

		updateState(plug.id, {
			lastCycleAt: startedAt,
			lastResult: "ok",
			lastError: null,
			pendingOn: false,
		});
		live.delete(plug.id);
		console.log(`Restarted plug ${plug.name} (${plug.ip})`);
		return { ok: true, error: null };
	} finally {
		busy.delete(plug.id);
	}
}

const toMinutes = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
};

// Ranges as real times around `time`, so midnight and clock changes work
function quietTimes(ranges: TQuietRange[], time: number) {
	const times: { start: number; end: number }[] = [];
	for (let offset = -2; offset <= 2; offset++) {
		for (const range of ranges) {
			const startMinutes = toMinutes(range.start);
			const endMinutes = toMinutes(range.end);
			const start = new Date(time);
			start.setDate(start.getDate() + offset);
			start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
			const end = new Date(start);
			if (endMinutes <= startMinutes) {
				end.setDate(end.getDate() + 1);
			}
			end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
			times.push({ start: start.getTime(), end: end.getTime() });
		}
	}
	return times;
}

function inQuietHours(ranges: TQuietRange[], time: number) {
	return quietTimes(ranges, time).some(
		(range) => time >= range.start && time < range.end,
	);
}

// Joined where they touch, so a moved restart never lands in another range
function quietBlock(ranges: TQuietRange[], time: number) {
	const padded = quietTimes(ranges, time)
		.map((range) => ({
			start: range.start - QUIET_MARGIN,
			end: range.end + QUIET_MARGIN,
		}))
		.sort((a, b) => a.start - b.start);
	const joined: typeof padded = [];
	for (const block of padded) {
		const last = joined.at(-1);
		if (last && block.start <= last.end) {
			last.end = Math.max(last.end, block.end);
		} else {
			joined.push({ ...block });
		}
	}
	return joined.find((block) => time >= block.start && time < block.end);
}

// Moves a restart out of quiet hours to the closer edge
export function nextRestart(plug: TPlugConfig, base: number, now: number) {
	const due = base + plug.intervalHours * 3600 * 1000;
	const ranges = plug.quietHours ?? [];
	if (!ranges.length) {
		return { at: due, movedFrom: null };
	}

	let at = due;
	if (inQuietHours(ranges, due)) {
		const block = quietBlock(ranges, due);
		if (block) {
			const before = block.start > base && due - block.start <= block.end - due;
			at = before ? block.start : block.end;
		}
	}

	if (at <= now && inQuietHours(ranges, now)) {
		const block = quietBlock(ranges, now);
		if (block) {
			at = block.end;
		}
	}

	return { at, movedFrom: at === due ? null : due };
}

async function tick() {
	const plugs = getPlugs();
	const state = readState();
	const now = Date.now();

	for (const plug of plugs) {
		if (busy.has(plug.id)) {
			continue;
		}
		const entry = state[plug.id] ?? {};

		// A plug left off gets on sent every minute until it reads as on
		if (entry.pendingOn) {
			busy.add(plug.id);
			switchOn(plug)
				.then((error) => {
					if (error) {
						return;
					}
					updateState(plug.id, {
						pendingOn: false,
						lastCycleAt: entry.lastAttemptAt ?? now,
						lastResult: "ok",
						lastError: null,
					});
					console.log(`Plug ${plug.name} (${plug.ip}) is back on`);
				})
				.catch(() => {})
				.finally(() => busy.delete(plug.id));
			continue;
		}

		// Counted from now, so adding a plug never cuts power straight away
		if (!entry.firstSeenAt) {
			updateState(plug.id, { firstSeenAt: now });
			continue;
		}

		const base = entry.lastCycleAt ?? entry.firstSeenAt;
		if (now >= nextRestart(plug, base, now).at) {
			cyclePlug(plug).catch(() => {});
		}
	}
}

async function readLive(plug: TPlugConfig) {
	const cached = live.get(plug.id);
	if (cached && Date.now() - cached.at < STATUS_TTL) {
		return cached;
	}
	const result = { at: Date.now(), online: await answers(plug.ip) };
	live.set(plug.id, result);
	return result;
}

export async function plugStatuses(): Promise<Record<number, TPlugStatus>> {
	const plugs = getPlugs();
	const state = readState();
	const statuses = await Promise.all(
		plugs.map(async (plug) => {
			const entry = state[plug.id] ?? {};
			const current = await readLive(plug);
			const base = entry.lastCycleAt ?? entry.firstSeenAt ?? Date.now();
			const next = nextRestart(plug, base, Date.now());
			const status: TPlugStatus = {
				online: current.online,
				busy: busy.has(plug.id),
				lastCycleAt: entry.lastCycleAt ?? null,
				lastResult: entry.lastResult ?? null,
				lastError: entry.lastError ?? null,
				nextCycleAt: next.at,
				movedFrom: next.movedFrom,
				pendingOn: Boolean(entry.pendingOn),
			};
			return [plug.id, status] as const;
		}),
	);
	return Object.fromEntries(statuses);
}

function parseQuietHours(raw: unknown): TQuietRange[] | string {
	if (raw === undefined || raw === null) {
		return [];
	}
	if (!Array.isArray(raw) || raw.length > MAX_QUIET_RANGES) {
		return `quiet hours can have up to ${MAX_QUIET_RANGES} ranges`;
	}

	const ranges: TQuietRange[] = [];
	for (const item of raw as Record<string, unknown>[]) {
		const start = String(item?.start ?? "").trim();
		const end = String(item?.end ?? "").trim();
		if (!timePattern.test(start) || !timePattern.test(end)) {
			return "quiet hours need a start and end time";
		}
		if (start === end) {
			return `quiet hours ${start} to ${end} start and end at the same time`;
		}
		ranges.push({ start, end });
	}

	// At least one free minute, margins included, so a restart can always land
	const covered = new Array(24 * 60).fill(false);
	const margin = QUIET_MARGIN / 60000;
	for (const range of ranges) {
		const start = toMinutes(range.start);
		let end = toMinutes(range.end);
		if (end <= start) {
			end += 24 * 60;
		}
		for (let minute = start - margin; minute < end + margin; minute++) {
			covered[(minute + 24 * 60) % (24 * 60)] = true;
		}
	}
	if (covered.every(Boolean)) {
		return "quiet hours cover the whole day, leaving no time for a restart";
	}

	return ranges;
}

// Known ids are kept so schedules carry over
export function parsePlugs(
	raw: unknown,
	bulbIps: string[],
): TPlugConfig[] | string {
	if (raw === undefined) {
		return getPlugs();
	}
	if (!Array.isArray(raw)) {
		return "Expected a list of plugs";
	}

	const existing = getPlugs();
	const used = new Set<number>();
	const output: TPlugConfig[] = [];

	for (const item of raw as Record<string, unknown>[]) {
		const name = String(item?.name ?? "").trim();
		const ip = String(item?.ip ?? "").trim();
		const intervalHours = Number(item?.intervalHours);

		if (!name || name.length > 64) {
			return "Every plug needs a name of up to 64 characters";
		}
		if (!hostPattern.test(ip)) {
			return `${name} has an invalid IP`;
		}
		if (output.some((plug) => plug.ip === ip)) {
			return `${ip} is used by more than one plug`;
		}
		if (bulbIps.includes(ip)) {
			return `${ip} is already a bulb`;
		}
		if (
			!Number.isFinite(intervalHours) ||
			intervalHours < MIN_HOURS ||
			intervalHours > MAX_HOURS
		) {
			return `${name} needs an interval between ${MIN_HOURS} and ${MAX_HOURS} hours`;
		}

		const quietHours = parseQuietHours(item?.quietHours);
		if (typeof quietHours === "string") {
			return `${name}: ${quietHours}`;
		}

		const id = Number(item?.id);
		const known =
			Number.isInteger(id) &&
			!used.has(id) &&
			existing.some((plug) => plug.id === id);
		output.push({
			id: known ? id : Number.NaN,
			name,
			ip,
			intervalHours,
			quietHours,
		});
		if (known) {
			used.add(id);
		}
	}

	let next = Math.max(0, ...existing.map((plug) => plug.id), ...used) + 1;
	for (const plug of output) {
		if (Number.isNaN(plug.id)) {
			plug.id = next++;
		}
	}
	return output;
}

// plug.py reads the account details from the environment api/.env set up
export function startPlugScheduler() {
	setTimeout(() => tick().catch(() => {}), 15 * 1000);
	setInterval(() => tick().catch(() => {}), TICK);
}
