import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { TActivity, TEvent, TInboxFile, TJob, TSeed } from "../shared/protocol";
import { Catalog, hashFile, TEMP_PREFIX, walk } from "./catalog";
import { AGE_PUB, FILES, IMPORT_ROOT, INBOX, PENDING, SEED, SEED_FILE, SETTLE_MS, TICK_MS } from "./config";
import { Schedule } from "./schedule";
import { ageOpen, ageOpenText, ageSeal, ageSealText, ensureAgeKey, isMounted, shred } from "./vault";

// One tick at a time: the inbox is sealed (locked) or imported (unlocked) inside the schedule, then pending and the Android copy

// Names upload tools use while a file is still arriving
const UNFINISHED = /(\.(tmp|temp|part|partial|crdownload|fstmp|filepart|!sync)$)|(^~\$)|(^\.syncthing\.)/i;
// Seed copying gives way to the inbox after this long
const SEED_SLICE_MS = 20 * 1000;
// A file that keeps failing is left alone until the next restart
const MAX_FAILURES = 3;
const MAX_EVENTS = 200;

type TMode = "inbox" | "pending" | "seed";
type TResult = { result: "imported" | "duplicate"; savedAs?: string };
type TSeedSaved = Omit<TSeed, "running">;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function variantName(rel: string, index: number) {
	const ext = path.posix.extname(rel);
	const base = ext && ext !== rel ? rel.slice(0, -ext.length) : rel;
	return `${base} (${index})${ext && ext !== rel ? ext : ""}`;
}

async function statOrNull(file: string) {
	try {
		return await fsp.stat(file);
	} catch {
		return null;
	}
}

// Setting a time goes through seconds as a float, so a copy can land a millisecond early
const sameTime = (a: number, b: number) => Math.abs(Math.floor(a) - Math.floor(b)) <= 2;

// Big chunks keep the drive's heads on one file for longer, it reads and writes the same disk
const CHUNK = 8 << 20;

// Hashes while copying, then reads the copy back, so a source is only shredded once the vault holds an identical file
async function copyVerified(source: string, target: string, onBytes: (bytes: number) => void, onVerify: () => void) {
	const hash = await copyHashed(source, target, onBytes);
	const handle = await fsp.open(target, "r+");
	await handle.sync();
	await handle.close();
	onVerify();
	if ((await hashFile(target, onBytes)) !== hash) {
		throw new Error("The copy did not match its source");
	}
	return hash;
}

async function copyHashed(source: string, target: string, onBytes: (bytes: number) => void) {
	const hash = createHash("sha256");
	await pipeline(
		fs.createReadStream(source, { highWaterMark: CHUNK }),
		new Transform({
			transform(chunk, _encoding, done) {
				hash.update(chunk);
				onBytes(chunk.length);
				done(null, chunk);
			},
		}),
		fs.createWriteStream(target, { mode: 0o600, highWaterMark: CHUNK }),
	);
	return hash.digest("hex");
}

export class Worker {
	readonly catalog = new Catalog();
	readonly schedule = new Schedule();
	lastCheck: number | null = null;
	activity: TActivity = {
		state: "idle",
		current: null,
		imported: 0,
		duplicates: 0,
		sealed: 0,
		failed: 0,
		lastImport: null,
		lastError: null,
		seed: null,
	};
	events: TEvent[] = [];
	inboxList: TInboxFile[] = [];
	inboxFiles = 0;
	inboxBytes = 0;
	pendingFiles = 0;
	pendingBytes = 0;

	private ready = false;
	private running = false;
	private paused = false;
	private reconcile: AbortController | null = null;
	private stable = new Map<string, string>();
	private failures = new Map<string, number>();
	private seedWalk: AsyncGenerator<{ full: string; rel: string; stats: fs.Stats }> | null = null;
	private lastSave = 0;
	// Set by checkNow, the next two ticks check the inbox whatever the schedule says, since a file must look the same twice
	private forced = 0;
	private countFiles = 0;
	private countBytes = 0;

	start() {
		setInterval(() => void this.tick(), TICK_MS);
		void this.tick();
	}

	// Lets the current file finish, then holds every tick until resume, used before locking
	async pause() {
		this.paused = true;
		this.reconcile?.abort();
		while (this.running) {
			await sleep(100);
		}
		if (this.ready) {
			await this.catalog.save().catch(() => {});
		}
	}

	resume() {
		this.paused = false;
	}

	// Called after a fresh unlock or creation so imports start straight away
	poke() {
		setTimeout(() => void this.tick(), 500);
	}

	// Waits for any running tick rather than starting a second one
	checkNow() {
		this.forced = 2;
		this.poke();
		setTimeout(() => void this.tick(), 500 + TICK_MS);
	}

	private checking() {
		return this.forced > 0 || this.schedule.isOpen();
	}

	restartSeed() {
		if (!this.ready || !fs.existsSync(SEED)) {
			return false;
		}
		this.seedWalk = null;
		this.activity.seed = { running: false, done: false, files: 0, bytes: 0, totalFiles: null, totalBytes: null, finishedAt: null };
		this.saveSeed();
		return true;
	}

	private async tick() {
		if (this.running || this.paused) {
			return;
		}
		this.running = true;
		let failed = false;
		try {
			const mounted = isMounted();
			if (mounted && !this.ready) {
				await this.onUnlock();
			} else if (!mounted && this.ready) {
				this.onLock();
			}
			if (this.checking()) {
				const forced = this.forced > 0;
				this.forced = Math.max(0, this.forced - 1);
				await this.inbox(forced);
				this.lastCheck = Date.now();
			}
			if (this.ready && !this.paused) {
				await this.pending();
			}
			if (this.ready && !this.paused) {
				await this.seedSlice();
			}
			this.startReconcile();
			if (this.ready && Date.now() - this.lastSave > 30 * 1000) {
				this.lastSave = Date.now();
				await this.catalog.save().catch(() => {});
			}
		} catch (error) {
			failed = true;
			this.note(error);
		} finally {
			this.activity.current = null;
			this.activity.state = this.paused ? "paused" : this.schedule.isOpen() ? "idle" : "waiting";
			this.running = false;
		}
		// An unfinished copy carries straight on instead of waiting for the next interval, unless the tick failed
		const seed = this.activity.seed;
		if (seed && !seed.done && this.ready && !this.paused && !failed) {
			setTimeout(() => void this.tick(), 50);
		}
	}

	private async onUnlock() {
		fs.mkdirSync(FILES, { recursive: true, mode: 0o700 });
		await ensureAgeKey();
		this.catalog.load();
		this.ready = true;
		this.reconcile = null;
		this.activity.seed = this.loadSeed();
		this.seedWalk = null;
	}

	// The full scan of the vault waits for the Android copy, both walking the same drive at once thrashes it
	private startReconcile() {
		const seed = this.activity.seed;
		if (this.reconcile || !this.ready || this.paused || (seed && !seed.done)) {
			return;
		}
		this.reconcile = new AbortController();
		void this.catalog.reconcile(this.reconcile.signal).catch(() => {});
	}

	private onLock() {
		this.ready = false;
		this.reconcile?.abort();
		this.catalog.unload();
		this.seedWalk = null;
		if (this.activity.seed) {
			this.activity.seed.running = false;
		}
	}

	// Progress

	private begin(kind: TJob["kind"], name: string, total: number) {
		this.activity.current = { kind, stage: "hashing", name, bytes: 0, total, startedAt: Date.now() };
	}

	private stage(stage: TJob["stage"]) {
		const job = this.activity.current;
		if (job) {
			job.stage = stage;
			job.bytes = 0;
		}
	}

	private progress = (bytes: number) => {
		if (this.activity.current) {
			this.activity.current.bytes += bytes;
		}
	};

	// age is a separate program, so its progress is the size of the file it is writing
	private async watchOutput<T>(file: string, action: Promise<T>) {
		const timer = setInterval(() => {
			fsp.stat(file).then(
				(stats) => {
					if (this.activity.current) {
						this.activity.current.bytes = stats.size;
					}
				},
				() => {},
			);
		}, 500);
		try {
			return await action;
		} finally {
			clearInterval(timer);
		}
	}

	private record(event: Omit<TEvent, "at">) {
		this.events.unshift({ ...event, at: Date.now() });
		if (this.events.length > MAX_EVENTS) {
			this.events.length = MAX_EVENTS;
		}
	}

	private note(error: unknown) {
		this.activity.failed++;
		this.activity.lastError = error instanceof Error ? error.message : "Unknown error";
	}

	private failedTooOften(key: string) {
		return (this.failures.get(key) ?? 0) >= MAX_FAILURES;
	}

	private recordFailure(key: string, name: string, size: number, error: unknown) {
		this.failures.set(key, (this.failures.get(key) ?? 0) + 1);
		this.note(error);
		this.record({ name, result: "failed", size });
	}

	private count(name: string, size: number, outcome: TResult) {
		if (outcome.result === "imported") {
			this.activity.imported++;
		} else {
			this.activity.duplicates++;
		}
		this.activity.lastImport = Date.now();
		this.record({ name, result: outcome.result, size, savedAs: outcome.savedAs });
	}

	// Inbox

	private async inbox(forced: boolean) {
		const list: TInboxFile[] = [];
		const ready: { full: string; rel: string; stats: fs.Stats }[] = [];
		const seen = new Set<string>();
		for await (const item of walk(INBOX)) {
			seen.add(item.rel);
			// Unchanged since the last tick and old enough, so the upload has finished
			const signature = `${item.stats.size}:${item.stats.mtimeMs}`;
			const unfinished = UNFINISHED.test(path.basename(item.rel));
			const settled = !unfinished && this.stable.get(item.rel) === signature && Date.now() - item.stats.mtimeMs > SETTLE_MS;
			const failing = this.failedTooOften(`inbox:${item.rel}`);
			this.stable.set(item.rel, signature);
			list.push({
				path: item.rel,
				size: item.stats.size,
				mtime: item.stats.mtimeMs,
				state: failing ? "failing" : settled ? "ready" : "uploading",
			});
			if (settled && !failing) {
				ready.push(item);
			}
		}
		for (const rel of [...this.stable.keys()]) {
			if (!seen.has(rel)) {
				this.stable.delete(rel);
			}
		}
		list.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
		this.inboxList = list;
		this.inboxFiles = list.length;
		this.inboxBytes = list.reduce((sum, file) => sum + file.size, 0);

		const recipient = this.ready ? null : await fsp.readFile(AGE_PUB, "utf-8").then((text) => text.trim(), () => null);
		for (const item of ready) {
			// A window that closes mid way lets the current file finish, the rest wait for the next one
			if (this.paused || (!forced && !this.schedule.isOpen())) {
				return;
			}
			try {
				if (this.ready) {
					this.activity.state = "importing";
					this.begin("inbox", item.rel, item.stats.size);
					this.count(item.rel, item.stats.size, await this.importFile(item.full, item.rel, "inbox"));
				} else if (recipient) {
					this.activity.state = "sealing";
					this.begin("seal", item.rel, item.stats.size);
					await this.seal(item.full, item.rel, recipient);
					this.activity.sealed++;
					this.record({ name: item.rel, result: "sealed", size: item.stats.size });
				} else {
					// No vault yet, so nothing can protect the file and it stays where it is
					return;
				}
				this.stage("shredding");
				await shred(item.full);
				this.stable.delete(item.rel);
				this.inboxList = this.inboxList.filter((file) => file.path !== item.rel);
				this.inboxFiles--;
				this.inboxBytes -= item.stats.size;
			} catch (error) {
				this.recordFailure(`inbox:${item.rel}`, item.rel, item.stats.size, error);
			} finally {
				this.activity.current = null;
			}
		}
	}

	// Random names, so pending reveals nothing about the files. The meta file is written last and marks a complete pair
	private async seal(source: string, rel: string, recipient: string) {
		const stats = await fsp.stat(source);
		const id = randomBytes(16).toString("hex");
		const data = path.join(PENDING, `${id}.data.age`);
		const meta = path.join(PENDING, `${id}.meta.age`);
		await fsp.mkdir(PENDING, { recursive: true });
		this.stage("sealing");
		await this.watchOutput(`${data}.tmp`, ageSeal(source, `${data}.tmp`, recipient));
		if ((await fsp.stat(`${data}.tmp`)).size < stats.size) {
			await fsp.rm(`${data}.tmp`, { force: true });
			throw new Error("A sealed file came out too small");
		}
		await fsp.rename(`${data}.tmp`, data);
		await ageSealText(JSON.stringify({ rel, size: stats.size, mtime: stats.mtimeMs }), `${meta}.tmp`, recipient);
		await fsp.rename(`${meta}.tmp`, meta);
	}

	// Pending

	private async pending() {
		let names: string[];
		try {
			names = await fsp.readdir(PENDING);
		} catch {
			names = [];
		}
		const ids = names.filter((name) => name.endsWith(".meta.age")).map((name) => name.slice(0, -".meta.age".length));
		this.pendingFiles = ids.length;
		this.pendingBytes = 0;
		for (const name of names) {
			if (name.endsWith(".data.age")) {
				this.pendingBytes += (await statOrNull(path.join(PENDING, name)))?.size ?? 0;
			}
		}
		for (const id of ids) {
			if (this.paused || !this.ready || this.failedTooOften(`pending:${id}`)) {
				continue;
			}
			const data = path.join(PENDING, `${id}.data.age`);
			const meta = path.join(PENDING, `${id}.meta.age`);
			const temp = path.join(FILES, `${TEMP_PREFIX}${randomBytes(8).toString("hex")}.tmp`);
			let name = "sealed file";
			let size = 0;
			try {
				this.activity.state = "importing";
				const info = JSON.parse(await ageOpenText(meta)) as { rel: string; size: number; mtime: number };
				if (typeof info.rel !== "string" || info.rel.split("/").some((part) => part === ".." || part === "")) {
					throw new Error("A pending file had a bad path");
				}
				name = info.rel;
				size = info.size;
				this.begin("pending", info.rel, info.size);
				this.stage("decrypting");
				// age authenticates every chunk, so a file that opens is exactly the one sealed
				await this.watchOutput(temp, ageOpen(data, temp));
				if ((await fsp.stat(temp)).size !== info.size) {
					throw new Error("A pending file opened at the wrong size");
				}
				const mtime = new Date(info.mtime);
				await fsp.utimes(temp, mtime, mtime);
				this.count(info.rel, info.size, await this.importFile(temp, info.rel, "pending"));
				await fsp.rm(data, { force: true });
				await fsp.rm(meta, { force: true });
				this.pendingFiles--;
			} catch (error) {
				this.recordFailure(`pending:${id}`, name, size, error);
			} finally {
				this.activity.current = null;
				await fsp.rm(temp, { force: true }).catch(() => {});
			}
		}
	}

	// Import

	// Every name the file could already have, its own and the numbered copies beside it
	private async existingNames(destRel: string) {
		const names: string[] = [];
		if (await statOrNull(path.join(FILES, destRel))) {
			names.push(destRel);
		}
		for (let index = 2; index < 1000; index++) {
			const name = variantName(destRel, index);
			if (!(await statOrNull(path.join(FILES, name)))) {
				break;
			}
			names.push(name);
		}
		return names;
	}

	private async freeName(destRel: string) {
		if (!(await statOrNull(path.join(FILES, destRel)))) {
			return destRel;
		}
		for (let index = 2; index < 100000; index++) {
			const name = variantName(destRel, index);
			if (!(await statOrNull(path.join(FILES, name)))) {
				return name;
			}
		}
		throw new Error("No free name for a file");
	}

	private async importFile(source: string, rel: string, mode: TMode): Promise<TResult> {
		const stats = await fsp.stat(source);
		const destRel = path.posix.join(IMPORT_ROOT, rel);

		// The seed copy only needs the quick check, its copies keep the source's size and time, the index answers without touching the drive
		if (mode === "seed") {
			const known = this.catalog.get(destRel);
			if (known && known.size === stats.size && sameTime(known.mtime, stats.mtimeMs)) {
				return { result: "duplicate" };
			}
		}
		const own = await this.existingNames(destRel);
		if (mode === "seed") {
			for (const name of own) {
				const existing = await statOrNull(path.join(FILES, name));
				if (existing && existing.size === stats.size && sameTime(existing.mtimeMs, stats.mtimeMs)) {
					return { result: "duplicate" };
				}
			}
		}

		// The seed mirrors the Android folder, so only its own path counts. Inbox files match anywhere in the vault
		const candidates = mode === "seed" ? own : [...new Set([...own, ...this.catalog.sameSize(stats.size)])];
		let sourceHash: string | null = null;
		for (const candidate of candidates) {
			const existing = await statOrNull(path.join(FILES, candidate));
			if (!existing?.isFile() || existing.size !== stats.size) {
				continue;
			}
			if (!sourceHash) {
				this.stage("hashing");
				sourceHash = await hashFile(source, this.progress);
			}
			this.stage("hashing");
			if ((await this.catalog.hashOf(candidate, existing, this.progress)) === sourceHash) {
				return { result: "duplicate" };
			}
		}

		// A different file under the same name is kept beside it, nothing in the vault is overwritten
		const finalRel = await this.freeName(destRel);
		const final = path.join(FILES, finalRel);
		await fsp.mkdir(path.dirname(final), { recursive: true, mode: 0o700 });
		let hash: string;
		if (mode === "pending") {
			if (!sourceHash) {
				this.stage("hashing");
				sourceHash = await hashFile(source, this.progress);
			}
			hash = sourceHash;
			await fsp.rename(source, final);
		} else {
			const temp = path.join(path.dirname(final), `${TEMP_PREFIX}${randomBytes(8).toString("hex")}.tmp`);
			try {
				this.stage("copying");
				// The seed's original stays put, so its copy skips the flush and read back the inbox needs before shredding
				hash =
					mode === "seed"
						? await copyHashed(source, temp, this.progress)
						: await copyVerified(source, temp, this.progress, () => this.stage("verifying"));
				if (sourceHash && hash !== sourceHash) {
					throw new Error("A file changed while it was imported");
				}
				await fsp.utimes(temp, stats.atime, stats.mtime);
				await fsp.rename(temp, final);
			} catch (error) {
				await fsp.rm(temp, { force: true }).catch(() => {});
				throw error;
			}
		}
		const written = await fsp.stat(final);
		this.catalog.set(finalRel, { size: written.size, mtime: Math.floor(written.mtimeMs), hash });
		return { result: "imported", savedAs: finalRel !== destRel ? finalRel : undefined };
	}

	// Seed

	private loadSeed(): TSeed | null {
		if (!fs.existsSync(SEED)) {
			return null;
		}
		try {
			const saved = JSON.parse(fs.readFileSync(SEED_FILE, "utf-8")) as TSeedSaved;
			return { ...saved, running: false };
		} catch {
			return { running: false, done: false, files: 0, bytes: 0, totalFiles: null, totalBytes: null, finishedAt: null };
		}
	}

	private saveSeed() {
		const seed = this.activity.seed;
		if (!seed || !this.ready) {
			return;
		}
		const { running: _running, ...saved } = seed;
		try {
			fs.writeFileSync(SEED_FILE, JSON.stringify(saved), { mode: 0o600 });
		} catch {}
	}

	private async seedSlice() {
		const seed = this.activity.seed;
		if (!seed || seed.done) {
			return;
		}
		const deadline = Date.now() + SEED_SLICE_MS;
		seed.running = true;

		// A first pass only counts, so progress has a total
		if (seed.totalFiles === null) {
			if (!this.seedWalk) {
				this.seedWalk = walk(SEED);
				this.countFiles = 0;
				this.countBytes = 0;
			}
			while (Date.now() < deadline && !this.paused) {
				const next = await this.seedWalk.next();
				if (next.done) {
					seed.totalFiles = this.countFiles;
					seed.totalBytes = this.countBytes;
					this.seedWalk = null;
					this.saveSeed();
					break;
				}
				this.countFiles++;
				this.countBytes += next.value.stats.size;
			}
			if (seed.totalFiles === null) {
				return;
			}
		}

		if (!this.seedWalk) {
			this.seedWalk = walk(SEED, undefined, (rel) => {
				// Empty folders come across too
				void fsp.mkdir(path.join(FILES, IMPORT_ROOT, rel), { recursive: true, mode: 0o700 }).catch(() => {});
			});
			seed.files = 0;
			seed.bytes = 0;
		}
		this.activity.state = "copying";
		while (Date.now() < deadline && !this.paused && this.ready) {
			const next = await this.seedWalk.next();
			if (next.done) {
				this.seedWalk = null;
				// Files that failed are counted in the activity, copying again retries them
				seed.done = true;
				seed.running = false;
				seed.finishedAt = Date.now();
				this.saveSeed();
				await this.catalog.save().catch(() => {});
				return;
			}
			const { full, rel, stats } = next.value;
			try {
				this.begin("seed", rel, stats.size);
				const outcome = await this.importFile(full, rel, "seed");
				if (outcome.result === "imported") {
					this.activity.imported++;
					this.activity.lastImport = Date.now();
					this.record({ name: rel, result: "copied", size: stats.size, savedAs: outcome.savedAs });
				} else {
					this.activity.duplicates++;
				}
			} catch (error) {
				this.note(error);
				this.record({ name: rel, result: "failed", size: stats.size });
			} finally {
				this.activity.current = null;
			}
			seed.files++;
			seed.bytes += stats.size;
			if (seed.files % 200 === 0) {
				this.saveSeed();
			}
		}
	}
}
