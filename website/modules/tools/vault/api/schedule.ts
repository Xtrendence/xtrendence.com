import fs from "node:fs";
import path from "node:path";
import { MAX_WINDOWS, type TWindow } from "../shared/protocol";
import { STATE } from "./config";

// When the inbox is checked, kept outside the vault so it also applies while locked

const FILE = path.join(STATE, "schedule.json");
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const minutes = (time: string) => {
	const [, hours, mins] = time.match(TIME) as RegExpMatchArray;
	return Number(hours) * 60 + Number(mins);
};

export function validate(value: unknown): TWindow[] {
	if (!Array.isArray(value) || value.length > MAX_WINDOWS) {
		throw new Error(`Set up to ${MAX_WINDOWS} windows`);
	}
	return value.map((window) => {
		const start = String(window?.start ?? "");
		const end = String(window?.end ?? "");
		if (!TIME.test(start) || !TIME.test(end)) {
			throw new Error("Times must look like 00:10");
		}
		if (start === end) {
			throw new Error("A window needs different start and end times");
		}
		return { start, end };
	});
}

export class Schedule {
	windows: TWindow[] = [];

	constructor() {
		try {
			this.windows = validate(JSON.parse(fs.readFileSync(FILE, "utf-8")).windows);
		} catch {
			this.windows = [];
		}
	}

	set(windows: TWindow[]) {
		this.windows = [...windows].sort((a, b) => minutes(a.start) - minutes(b.start));
		fs.writeFileSync(FILE, JSON.stringify({ windows: this.windows }), { mode: 0o600 });
	}

	isOpen(now = new Date()) {
		if (this.windows.length === 0) {
			return true;
		}
		const current = now.getHours() * 60 + now.getMinutes();
		return this.windows.some(({ start, end }) => {
			const from = minutes(start);
			const to = minutes(end);
			return from < to ? current >= from && current < to : current >= from || current < to;
		});
	}

	nextOpen(now = new Date()) {
		if (this.windows.length === 0 || this.isOpen(now)) {
			return null;
		}
		let soonest = Number.POSITIVE_INFINITY;
		for (const { start } of this.windows) {
			const at = new Date(now);
			at.setHours(Math.floor(minutes(start) / 60), minutes(start) % 60, 0, 0);
			if (at.getTime() <= now.getTime()) {
				at.setDate(at.getDate() + 1);
			}
			soonest = Math.min(soonest, at.getTime());
		}
		return soonest;
	}
}
