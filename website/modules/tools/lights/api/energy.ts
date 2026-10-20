import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type { TEnergyRange, TEnergyReport } from "../shared/types";
import { answers, busy, getPlugs, tapo } from "./plugs";

// Copies each plug's own energy history into a local database, so it outlives the plug's memory and reads instantly

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SYNC_EVERY = 15 * 60 * 1000;
// The first sync after a start reaches back five quarters, later ones only the current one
const BACKFILL_QUARTERS = 5;

const db = new DatabaseSync(path.join(__dirname, "energy.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
	CREATE TABLE IF NOT EXISTS energy_hourly (plug INTEGER, t INTEGER, wh REAL, PRIMARY KEY (plug, t));
	CREATE TABLE IF NOT EXISTS energy_daily (plug INTEGER, t INTEGER, wh REAL, PRIMARY KEY (plug, t));
`);

// Stored readings only ever go up, so a plug that was reset and reports zeros cannot wipe history kept here
const upsert = (table: string) =>
	db.prepare(
		`INSERT INTO ${table} (plug, t, wh) VALUES (?, ?, ?) ON CONFLICT (plug, t) DO UPDATE SET wh = MAX(wh, excluded.wh)`,
	);
const saveHourly = upsert("energy_hourly");
const saveDaily = upsert("energy_daily");

type TLive = {
	powerW: number | null;
	todayWh: number | null;
	monthWh: number | null;
	syncedAt: number;
	error: string | null;
};
const live = new Map<number, TLive>();
const backfilled = new Set<number>();

// Daily entries drift an hour around clock changes, so they are snapped to the local day they belong to
function localDay(time: number) {
	const day = new Date(time + 12 * HOUR);
	day.setHours(0, 0, 0, 0);
	return day.getTime();
}

async function syncPlug(id: number, ip: string) {
	const quarters = backfilled.has(id) ? 1 : BACKFILL_QUARTERS;
	const { replies, error } = await tapo(ip, "energy", String(quarters));
	const usage = replies.find((reply) => reply.kind === "usage");
	if (!usage) {
		live.set(id, {
			...(live.get(id) ?? { powerW: null, todayWh: null, monthWh: null }),
			syncedAt: Date.now(),
			error: error ?? "No energy data",
		});
		return;
	}

	const now = Date.now();
	const today = localDay(now);
	db.exec("BEGIN");
	try {
		for (const reply of replies) {
			for (const [time, wh] of reply.entries ?? []) {
				if (reply.kind === "hourly" && time <= now) {
					saveHourly.run(id, time, wh);
				}
				if (reply.kind === "daily" && localDay(time) <= today) {
					saveDaily.run(id, localDay(time), wh);
				}
			}
		}
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}

	backfilled.add(id);
	live.set(id, {
		powerW: typeof usage.power === "number" ? usage.power / 1000 : null,
		todayWh: usage.today ?? null,
		monthWh: usage.month ?? null,
		syncedAt: now,
		error: null,
	});
}

let syncing: Promise<void> | null = null;

// One plug at a time, skipping busy or silent ones, and overlapping callers share one run
function syncAll() {
	syncing ??= (async () => {
		for (const plug of getPlugs()) {
			if (busy.has(plug.id) || !(await answers(plug.ip))) {
				continue;
			}
			await syncPlug(plug.id, plug.ip).catch(() => {});
		}
	})().finally(() => {
		syncing = null;
	});
	return syncing;
}

export async function syncEnergyNow() {
	await syncAll();
	return { syncedAt: Date.now() };
}

// Run after settings are saved, so a plug that was just added shows its history straight away
export function syncNewPlugs() {
	const fresh = getPlugs().filter((plug) => !live.has(plug.id));
	(async () => {
		for (const plug of fresh) {
			if (!busy.has(plug.id) && (await answers(plug.ip))) {
				await syncPlug(plug.id, plug.ip).catch(() => {});
			}
		}
	})().catch(() => {});
}

export function startEnergySync() {
	setTimeout(() => syncAll().catch(() => {}), 30 * 1000);
	setInterval(() => syncAll().catch(() => {}), SYNC_EVERY);
}

const RANGES: Record<
	TEnergyRange,
	{ span: number; bucket: number; table: "energy_hourly" | "energy_daily" }
> = {
	"1d": { span: DAY, bucket: HOUR, table: "energy_hourly" },
	"7d": { span: 7 * DAY, bucket: HOUR, table: "energy_hourly" },
	"30d": { span: 30 * DAY, bucket: DAY, table: "energy_daily" },
	"1y": { span: 365 * DAY, bucket: DAY, table: "energy_daily" },
};

export function isEnergyRange(value: unknown): value is TEnergyRange {
	return typeof value === "string" && value in RANGES;
}

export function energyReport(range: TEnergyRange): TEnergyReport {
	const { span, bucket, table } = RANGES[range];
	const now = Date.now();
	// Daily ranges start on a day boundary, so the first bar is a whole day
	const since =
		table === "energy_daily"
			? localDay(now - span + DAY)
			: Math.floor((now - span) / HOUR) * HOUR + HOUR;
	const query = db.prepare(
		`SELECT t, wh FROM ${table} WHERE plug = ? AND t >= ? ORDER BY t`,
	);

	const plugs = getPlugs().map((plug) => {
		const series = (
			query.all(plug.id, since) as { t: number; wh: number }[]
		).map((row) => [row.t, row.wh] as [number, number]);
		const state = live.get(plug.id);
		return {
			id: plug.id,
			name: plug.name,
			series,
			totalWh: series.reduce((sum, [, wh]) => sum + wh, 0),
			powerW: state?.powerW ?? null,
			todayWh: state?.todayWh ?? null,
			monthWh: state?.monthWh ?? null,
			syncedAt: state?.syncedAt ?? null,
			error: state?.error ?? null,
		};
	});

	return {
		range,
		since,
		now,
		bucket,
		plugs,
		totalWh: plugs.reduce((sum, plug) => sum + plug.totalWh, 0),
	};
}
