import fs from "node:fs";
import { IDLE_MAX, IDLE_MIN } from "../shared/protocol";
import { IDLE_MINUTES, MOUNT } from "./config";

// Every file operation on the mount goes through gocryptfs, so its I/O counters only move when the vault is used
function findGocryptfs() {
	for (const pid of fs.readdirSync("/proc")) {
		if (!/^\d+$/.test(pid)) {
			continue;
		}
		try {
			const args = fs.readFileSync(`/proc/${pid}/cmdline`, "utf-8").split("\0");
			if (args[0].endsWith("gocryptfs") && args.includes(MOUNT)) {
				return pid;
			}
		} catch {}
	}
	return null;
}

function readCounters(pid: string) {
	const io = fs.readFileSync(`/proc/${pid}/io`, "utf-8");
	return io.match(/^(rchar|wchar): \d+$/gm)?.join() ?? "";
}

export class Idle {
	minutes = IDLE_MINUTES;
	lastUse = Date.now();
	// False when the counters can't be read, the vault then never locks for being idle
	watching = false;
	private pid: string | null = null;
	private counters = "";

	reset() {
		this.minutes = IDLE_MINUTES;
		this.lastUse = Date.now();
		this.pid = null;
		this.counters = "";
	}

	touch() {
		this.lastUse = Date.now();
	}

	set(minutes: number) {
		this.minutes = Math.min(Math.max(Math.round(minutes), IDLE_MIN), IDLE_MAX);
		this.touch();
	}

	lockAt() {
		return this.lastUse + this.minutes * 60 * 1000;
	}

	// Returns true once the vault has gone unused for the whole timeout
	sample(now = Date.now()) {
		try {
			this.pid ??= findGocryptfs();
			if (!this.pid) {
				this.watching = false;
				return false;
			}
			const counters = readCounters(this.pid);
			if (counters !== this.counters) {
				this.counters = counters;
				this.lastUse = now;
			}
			this.watching = true;
		} catch {
			this.pid = null;
			this.watching = false;
			return false;
		}
		return now >= this.lockAt();
	}
}
