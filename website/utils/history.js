import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { collectServerStats, diffCpu, readCpuSample } from "./serverStats.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, "../data/history.db");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const KEEP_MINUTES = 8 * DAY;
const KEEP_HOURS = 400 * DAY;

// Drives need this much history before a forecast means anything
const FORECAST_MIN_SPAN = 2 * DAY;
const FORECAST_WINDOW = 14 * DAY;

const METRICS = ["cpu", "mem", "swap", "temp", "rx", "tx"];

export const RANGES = {
	"24h": { span: DAY, bucket: 5 * MINUTE, table: "samples" },
	"7d": { span: 7 * DAY, bucket: HOUR, table: "samples" },
	"30d": { span: 30 * DAY, bucket: 6 * HOUR, table: "hourly" },
	"1y": { span: 365 * DAY, bucket: DAY, table: "hourly" },
};

let db = null;

export function historyDb() {
	if (db) return db;

	fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
	db = new DatabaseSync(DB_FILE);
	db.exec(`
		PRAGMA journal_mode = WAL;
		CREATE TABLE IF NOT EXISTS samples (t INTEGER PRIMARY KEY, cpu REAL, mem REAL, swap REAL, temp REAL, rx REAL, tx REAL);
		CREATE TABLE IF NOT EXISTS hourly (t INTEGER PRIMARY KEY, cpu REAL, mem REAL, swap REAL, temp REAL, rx REAL, tx REAL);
		CREATE TABLE IF NOT EXISTS drive_samples (t INTEGER, mount TEXT, used REAL, size REAL, PRIMARY KEY (t, mount));
		CREATE TABLE IF NOT EXISTS drive_hourly (t INTEGER, mount TEXT, used REAL, size REAL, PRIMARY KEY (t, mount));
		CREATE TABLE IF NOT EXISTS alert_events (id INTEGER PRIMARY KEY AUTOINCREMENT, rule TEXT, label TEXT, level TEXT, message TEXT, started INTEGER, ended INTEGER);
		CREATE INDEX IF NOT EXISTS alert_events_started ON alert_events (started);
		CREATE TABLE IF NOT EXISTS outages (id INTEGER PRIMARY KEY AUTOINCREMENT, started INTEGER, ended INTEGER, reason TEXT);
		CREATE INDEX IF NOT EXISTS outages_started ON outages (started);
	`);
	return db;
}

// Sampling

let lastCpu = null;
let lastNet = null;

async function sample() {
	const now = Date.now();
	const stats = await collectServerStats();

	// Measured across the whole minute, not the short window the page uses
	const cpuNow = readCpuSample();
	const cpu = lastCpu ? (diffCpu(lastCpu, cpuNow).cpu ?? null) : null;
	lastCpu = cpuNow;

	const net = { t: now, rx: stats.network?.received ?? 0, tx: stats.network?.transmitted ?? 0 };
	let rx = null;
	let tx = null;
	// A counter that went backwards means the interface reset, not traffic
	if (lastNet && net.rx >= lastNet.rx && net.tx >= lastNet.tx) {
		const seconds = (now - lastNet.t) / 1000;
		rx = (net.rx - lastNet.rx) / seconds;
		tx = (net.tx - lastNet.tx) / seconds;
	}
	lastNet = net;

	const database = historyDb();
	const t = Math.floor(now / MINUTE) * MINUTE;

	database
		.prepare("INSERT OR REPLACE INTO samples (t, cpu, mem, swap, temp, rx, tx) VALUES (?, ?, ?, ?, ?, ?, ?)")
		.run(t, cpu, stats.memory?.percent ?? null, stats.memory?.swap?.used ?? null, stats.temperatures?.[0]?.value ?? null, rx, tx);

	const insertDrive = database.prepare("INSERT OR REPLACE INTO drive_samples (t, mount, used, size) VALUES (?, ?, ?, ?)");
	for (const drive of stats.drives ?? []) {
		insertDrive.run(t, drive.mount, drive.used, drive.size);
	}
}

// Folds each finished hour into the hourly tables, then trims old detail
function rollup() {
	const database = historyDb();
	const currentHour = Math.floor(Date.now() / HOUR) * HOUR;

	const averages = METRICS.map((metric) => `AVG(${metric})`).join(", ");
	database.exec(`
		INSERT OR IGNORE INTO hourly (t, ${METRICS.join(", ")})
		SELECT (t / ${HOUR}) * ${HOUR} AS hour, ${averages}
		FROM samples WHERE t < ${currentHour} GROUP BY hour;

		INSERT OR IGNORE INTO drive_hourly (t, mount, used, size)
		SELECT (t / ${HOUR}) * ${HOUR} AS hour, mount, AVG(used), AVG(size)
		FROM drive_samples WHERE t < ${currentHour} GROUP BY hour, mount;
	`);

	const now = Date.now();
	database.prepare("DELETE FROM samples WHERE t < ?").run(now - KEEP_MINUTES);
	database.prepare("DELETE FROM drive_samples WHERE t < ?").run(now - KEEP_MINUTES);
	database.prepare("DELETE FROM hourly WHERE t < ?").run(now - KEEP_HOURS);
	database.prepare("DELETE FROM drive_hourly WHERE t < ?").run(now - KEEP_HOURS);
	database.prepare("DELETE FROM alert_events WHERE ended IS NOT NULL AND ended < ?").run(now - KEEP_HOURS);
	database.prepare("DELETE FROM outages WHERE ended IS NOT NULL AND ended < ?").run(now - KEEP_HOURS);
}

export function startHistory() {
	historyDb();

	const tick = () =>
		sample().catch((error) => {
			console.log(`History sample failed: ${error?.message}`);
		});

	tick();
	setInterval(tick, MINUTE);

	const roll = () => {
		try {
			rollup();
		} catch (error) {
			console.log(`History rollup failed: ${error?.message}`);
		}
	};
	setTimeout(roll, 2 * MINUTE);
	setInterval(roll, HOUR);
}

// Alert events, one row per stretch of time a rule spent failing

export function recordAlertState(issues) {
	const database = historyDb();
	const now = Date.now();
	const open = database.prepare("SELECT id, rule, level FROM alert_events WHERE ended IS NULL").all();
	const active = new Map(issues.map((issue) => [issue.id, issue]));

	const close = database.prepare("UPDATE alert_events SET ended = ? WHERE id = ?");
	const openEvent = database.prepare(
		"INSERT INTO alert_events (rule, label, level, message, started, ended) VALUES (?, ?, ?, ?, ?, NULL)",
	);

	const stillOpen = new Set();
	for (const event of open) {
		const issue = active.get(event.rule);
		// A rule that changed level is closed and reopened, so the timeline
		// shows when it escalated
		if (!issue || issue.level !== event.level) {
			close.run(now, event.id);
		} else {
			stillOpen.add(event.rule);
		}
	}

	for (const issue of issues) {
		if (!stillOpen.has(issue.id)) {
			openEvent.run(issue.id, issue.label, issue.level, issue.message, now);
		}
	}
}

// Outages, written by the connectivity monitor

export function openOutage(started, reason) {
	const database = historyDb();
	const existing = database.prepare("SELECT id FROM outages WHERE ended IS NULL").get();
	if (existing) return existing.id;
	return database.prepare("INSERT INTO outages (started, ended, reason) VALUES (?, NULL, ?)").run(started, reason).lastInsertRowid;
}

export function closeOutage(ended) {
	const database = historyDb();
	const open = database.prepare("SELECT id, started, reason FROM outages WHERE ended IS NULL").get();
	if (!open) return null;
	database.prepare("UPDATE outages SET ended = ? WHERE id = ?").run(ended, open.id);
	return { ...open, ended };
}

export function currentOutage() {
	return historyDb().prepare("SELECT id, started, reason FROM outages WHERE ended IS NULL").get() ?? null;
}

// Share of the window the connection was up. Time before monitoring began
// is left out rather than counted as up
function uptime(span, now) {
	const database = historyDb();
	const first = database.prepare("SELECT MIN(t) AS t FROM samples").get()?.t;
	const firstHourly = database.prepare("SELECT MIN(t) AS t FROM hourly").get()?.t;
	const since = Math.max(now - span, Math.min(first ?? now, firstHourly ?? now));
	const window = now - since;
	if (window <= 0) return null;

	const rows = database
		.prepare("SELECT started, ended FROM outages WHERE started < ? AND (ended IS NULL OR ended > ?)")
		.all(now, since);
	const down = rows.reduce((sum, row) => sum + (Math.min(row.ended ?? now, now) - Math.max(row.started, since)), 0);
	return Math.max(0, Math.min(100, (1 - down / window) * 100));
}

// Forecasts

// Least squares over recent usage. Only a drive that is actually growing
// gets a date, a flat or shrinking one reads as not filling
export function driveForecasts(now = Date.now()) {
	const database = historyDb();
	const since = now - FORECAST_WINDOW;
	const rows = database
		.prepare(
			`SELECT t, mount, used, size FROM drive_hourly WHERE t >= ?
			 UNION ALL
			 SELECT t, mount, used, size FROM drive_samples WHERE t >= (SELECT COALESCE(MAX(t), 0) FROM drive_hourly)`,
		)
		.all(since);

	const byMount = new Map();
	for (const row of rows) {
		if (!byMount.has(row.mount)) byMount.set(row.mount, []);
		byMount.get(row.mount).push(row);
	}

	return [...byMount.entries()].map(([mount, points]) => {
		points.sort((a, b) => a.t - b.t);
		const latest = points.at(-1);
		const span = latest.t - points[0].t;
		const base = { mount, used: latest.used, size: latest.size, percent: (latest.used / latest.size) * 100 };

		if (points.length < 3 || span < FORECAST_MIN_SPAN) {
			return { ...base, perDay: null, daysToFull: null, enoughHistory: false };
		}

		const n = points.length;
		const meanT = points.reduce((sum, p) => sum + p.t, 0) / n;
		const meanU = points.reduce((sum, p) => sum + p.used, 0) / n;
		let numerator = 0;
		let denominator = 0;
		for (const p of points) {
			numerator += (p.t - meanT) * (p.used - meanU);
			denominator += (p.t - meanT) ** 2;
		}
		const perMs = denominator ? numerator / denominator : 0;
		const perDay = perMs * DAY;
		const daysToFull = perDay > 0 ? (latest.size - latest.used) / perDay : null;

		return { ...base, perDay, daysToFull, enoughHistory: true };
	});
}

// Queries for the dashboard

export function getHistory(rangeName = "24h", now = Date.now()) {
	const range = RANGES[rangeName] ?? RANGES["24h"];
	const database = historyDb();
	const since = now - range.span;

	const bucketExpr = `(t / ${range.bucket}) * ${range.bucket}`;
	const averages = METRICS.map((metric) => `AVG(${metric}) AS ${metric}`).join(", ");
	const peaks = METRICS.map((metric) => `MAX(${metric}) AS ${metric}_max`).join(", ");

	// Recent minutes are not in the hourly table yet, so long ranges read both
	const source =
		range.table === "hourly"
			? `SELECT * FROM hourly WHERE t >= ${since} UNION ALL SELECT * FROM samples WHERE t >= (SELECT COALESCE(MAX(t) + ${HOUR}, 0) FROM hourly)`
			: `SELECT * FROM samples WHERE t >= ${since}`;

	const rows = database
		.prepare(`SELECT ${bucketExpr} AS bucket, ${averages}, ${peaks} FROM (${source}) GROUP BY bucket ORDER BY bucket`)
		.all();

	const series = {};
	for (const metric of METRICS) {
		series[metric] = rows.map((row) => [row.bucket, row[metric], row[`${metric}_max`]]);
	}

	const driveSource =
		range.table === "hourly"
			? `SELECT * FROM drive_hourly WHERE t >= ${since} UNION ALL SELECT * FROM drive_samples WHERE t >= (SELECT COALESCE(MAX(t) + ${HOUR}, 0) FROM drive_hourly)`
			: `SELECT * FROM drive_samples WHERE t >= ${since}`;
	const driveRows = database
		.prepare(
			`SELECT ${bucketExpr} AS bucket, mount, AVG(used * 100.0 / size) AS percent FROM (${driveSource}) GROUP BY bucket, mount ORDER BY bucket`,
		)
		.all();
	const drives = {};
	for (const row of driveRows) {
		(drives[row.mount] ??= []).push([row.bucket, row.percent]);
	}

	const alerts = database
		.prepare("SELECT rule, label, level, message, started, ended FROM alert_events WHERE started < ? AND (ended IS NULL OR ended > ?) ORDER BY started DESC")
		.all(now, since);

	const outages = database
		.prepare("SELECT started, ended, reason FROM outages WHERE started < ? AND (ended IS NULL OR ended > ?) ORDER BY started DESC")
		.all(now, since);

	return {
		range: rangeName in RANGES ? rangeName : "24h",
		since,
		now,
		bucket: range.bucket,
		series,
		drives,
		forecasts: driveForecasts(now),
		alerts,
		outages,
		uptime: { "24h": uptime(DAY, now), "7d": uptime(7 * DAY, now), "30d": uptime(30 * DAY, now) },
		currentOutage: currentOutage(),
	};
}
