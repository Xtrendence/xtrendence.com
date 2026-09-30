import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getContainerStates } from "./serverStats.js";

// Trackers that need history between the 5 minute checks. Each one keeps
// its own state in memory and is rebuilt from scratch on restart

const TRACK_INTERVAL = 15 * 1000;

// Crash loop tuning
const LOOP_WINDOW = 5 * 60 * 1000;
const LOOP_MIN_RESTARTS = 11;
const LOOP_MAX_VARIATION = 0.35;
const LOOP_TOLERANCE = 0.5;
const LOOP_BREAK_AFTER = 5;
const LOOP_EXPIRES = 20 * 60 * 1000;

// Container health tuning
const CONTAINER_GRACE = 5 * 60 * 1000;

const PM2_LOG = path.join(os.homedir(), ".pm2/pm2.log");
const PM2_START = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}): PM2 log: App \[(.+):\d+\] starting in/;

// On startup only this much of the log is replayed, enough to cover a loop
// that was already running when the website restarted
const REPLAY_BYTES = 2 * 1024 * 1024;

const apps = new Map();
let logOffset = null;
let logRemainder = "";

const unhealthySince = new Map();

function appState(name) {
	if (!apps.has(name)) {
		apps.set(name, { recent: [], loop: null });
	}
	return apps.get(name);
}

function clearLoop(state) {
	state.loop = null;
	state.recent = [];
}

// Steady gaps are what separate a crash loop from restarting by hand
function steadyInterval(times) {
	const gaps = times.slice(1).map((time, index) => time - times[index]);
	const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
	if (mean <= 0) return null;
	const variance = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
	return Math.sqrt(variance) / mean <= LOOP_MAX_VARIATION ? mean : null;
}

function recordStart(name, time) {
	const state = appState(name);

	if (state.loop) {
		const gap = time - state.loop.last;
		state.loop.last = time;
		state.loop.restarts += 1;

		// Only consecutive off-pattern restarts count as the loop breaking
		const offPattern = Math.abs(gap - state.loop.interval) > state.loop.interval * LOOP_TOLERANCE;
		state.loop.broken = offPattern ? state.loop.broken + 1 : 0;

		if (state.loop.broken >= LOOP_BREAK_AFTER) {
			clearLoop(state);
		}
		return;
	}

	state.recent.push(time);
	state.recent = state.recent.filter((start) => start > time - LOOP_WINDOW);

	if (state.recent.length >= LOOP_MIN_RESTARTS) {
		const interval = steadyInterval(state.recent);
		if (interval) {
			state.loop = {
				interval,
				detectedAt: time,
				last: time,
				restarts: state.recent.length,
				broken: 0,
			};
			state.recent = [];
		}
	}
}

function readLog() {
	let stat;
	try {
		stat = fs.statSync(PM2_LOG);
	} catch {
		return;
	}

	// A smaller file means pm2 rotated or flushed it
	if (logOffset === null || stat.size < logOffset) {
		logOffset = logOffset === null ? Math.max(0, stat.size - REPLAY_BYTES) : 0;
		logRemainder = "";
	}

	if (stat.size === logOffset) return;

	const length = stat.size - logOffset;
	const buffer = Buffer.alloc(length);
	const handle = fs.openSync(PM2_LOG, "r");
	try {
		fs.readSync(handle, buffer, 0, length, logOffset);
	} finally {
		fs.closeSync(handle);
	}
	logOffset = stat.size;

	const lines = (logRemainder + buffer.toString("utf-8")).split("\n");
	logRemainder = lines.pop() ?? "";

	const cutoff = Date.now() - LOOP_EXPIRES - LOOP_WINDOW;
	for (const line of lines) {
		const match = line.match(PM2_START);
		if (!match) continue;
		const time = new Date(match[1]).getTime();
		if (Number.isNaN(time) || time < cutoff) continue;
		recordStart(match[2], time);
	}
}

function expireLoops() {
	const now = Date.now();
	for (const state of apps.values()) {
		if (state.loop && now - state.loop.detectedAt >= LOOP_EXPIRES) {
			clearLoop(state);
		}
	}
}

async function trackContainers() {
	const containers = await getContainerStates();
	const now = Date.now();
	const bad = new Set();

	for (const container of containers) {
		const unhealthy = container.state === "restarting" || /\(unhealthy\)/i.test(container.status ?? "");
		if (!unhealthy) continue;
		bad.add(container.name);
		if (!unhealthySince.has(container.name)) {
			unhealthySince.set(container.name, {
				since: now,
				reason: container.state === "restarting" ? "restarting" : "unhealthy",
			});
		}
	}

	for (const name of unhealthySince.keys()) {
		if (!bad.has(name)) unhealthySince.delete(name);
	}
}

function track() {
	try {
		readLog();
		expireLoops();
	} catch (error) {
		console.log(`Crash loop tracker failed: ${error?.message}`);
	}
	trackContainers().catch((error) => {
		console.log(`Container tracker failed: ${error?.message}`);
	});
}

export function getCrashLoops() {
	expireLoops();
	return [...apps.entries()]
		.filter(([, state]) => state.loop)
		.map(([name, state]) => ({
			name,
			interval: state.loop.interval,
			restarts: state.loop.restarts,
			detectedAt: state.loop.detectedAt,
		}));
}

export function getUnhealthyContainers() {
	const now = Date.now();
	return [...unhealthySince.entries()]
		.filter(([, entry]) => now - entry.since >= CONTAINER_GRACE)
		.map(([name, entry]) => ({ name, reason: entry.reason, since: entry.since }));
}

export function startTrackers() {
	track();
	setInterval(track, TRACK_INTERVAL);
}
