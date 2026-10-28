import express, { type Request, type Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import {
	CHUNK_BYTES,
	MAX_PASSWORD,
	MIN_PASSWORD,
	type TEntry,
	type TMirror,
	type TRequest,
	type TResponse,
	type TSchedule,
	type TStatus,
	type TStorage,
} from "../shared/protocol";
import { TEMP_PREFIX } from "./catalog";
import { ALLOWED, CIPHER, CONTROL_PORT, DIST, FILES, HOST, IDLE_MINUTES, IMPORT_ROOT, INBOX, MIRROR_ENABLED, PORT, STATE, TMP } from "./config";
import { Idle } from "./idle";
import { Mirror } from "./mirror";
import { validate } from "./schedule";
import { deriveSessionKey, loadServerKey, open, seal, type TSessionKey } from "./crypto";
import * as vault from "./vault";
import { Worker } from "./worker";

// Plain HTTP on the LAN and VPN only, so everything after the key exchange is sealed end to end and nothing about the files is logged

fs.mkdirSync(TMP, { recursive: true, mode: 0o700 });
const serverKey = loadServerKey();
const worker = new Worker();

// Access

const allowed = ALLOWED.map((cidr) => {
	const [address, bits] = cidr.split("/");
	const list = new net.BlockList();
	list.addSubnet(address, Number(bits), "ipv4");
	return list;
});

function remoteAddress(req: Request) {
	const address = req.socket.remoteAddress ?? "";
	return address.startsWith("::ffff:") ? address.slice(7) : address;
}

function isAllowed(address: string) {
	return net.isIPv4(address) && allowed.some((list) => list.check(address, "ipv4"));
}

// Wrong passwords, per address and across all of them

const WINDOW_MS = 15 * 60 * 1000;
const PER_ADDRESS = 5;
const OVERALL = 20;
const failures = new Map<string, number[]>();

function recentFailures(key: string) {
	const list = (failures.get(key) ?? []).filter((time) => time > Date.now() - (key === "*" ? 4 * WINDOW_MS : WINDOW_MS));
	failures.set(key, list);
	return list;
}

function blocked(address: string) {
	return recentFailures(address).length >= PER_ADDRESS || recentFailures("*").length >= OVERALL;
}

function recordFailure(address: string) {
	recentFailures(address).push(Date.now());
	recentFailures("*").push(Date.now());
}

// Sessions, memory only

type TSession = {
	key: TSessionKey;
	address: string;
	seen: Set<number>;
	highest: number;
	authed: boolean;
	generation: number;
	lastSeen: number;
};

const SESSION_IDLE_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 64;
const sessions = new Map<string, TSession>();

// Bumped every time the vault is mounted, so a session only counts for the unlock it was made in
let generation = 0;
let wasMounted = false;

const idle = new Idle();
const mirror = new Mirror();

function mounted() {
	const now = vault.isMounted();
	if (now && !wasMounted) {
		generation++;
		idle.reset();
		idle.sample();
	}
	wasMounted = now;
	return now;
}

function authed(session: TSession) {
	return session.authed && session.generation === generation && mounted();
}

setInterval(() => {
	for (const [id, session] of sessions) {
		if (Date.now() - session.lastSeen > SESSION_IDLE_MS) {
			sessions.delete(id);
		}
	}
}, 60 * 1000).unref();

// A job in progress counts as use even while it only reads the inbox
let idleLocking = false;
setInterval(() => {
	if (idleLocking || !mounted()) {
		return;
	}
	if (worker.activity.current) {
		idle.touch();
	}
	if (idle.sample()) {
		idleLocking = true;
		console.log(`Locking after ${idle.minutes} min without use`);
		void lockVault()
			.catch((error) => console.error("Idle lock failed", error))
			.finally(() => {
				idleLocking = false;
			});
	}
}, 5 * 1000).unref();

// Storage

let vaultBytes: number | null = null;
let vaultBytesAt = 0;

async function storage(): Promise<TStorage> {
	if (Date.now() - vaultBytesAt > 5 * 60 * 1000) {
		vaultBytesAt = Date.now();
		void vault.diskUsage(CIPHER).then((bytes) => {
			vaultBytes = bytes;
		});
	}
	const drive = await fsp.statfs(path.dirname(CIPHER));
	return {
		vaultBytes,
		driveTotal: drive.blocks * drive.bsize,
		driveFree: drive.bavail * drive.bsize,
		inboxFiles: worker.inboxFiles,
		inboxBytes: worker.inboxBytes,
		pendingFiles: worker.pendingFiles,
		pendingBytes: worker.pendingBytes,
	};
}

class Refusal extends Error {}

function schedule(): TSchedule {
	return {
		windows: worker.schedule.windows,
		open: worker.schedule.isOpen(),
		nextOpen: worker.schedule.nextOpen(),
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		lastCheck: worker.lastCheck,
	};
}

// Paths from the browser, always inside the vault's files folder

function resolveInside(relative: unknown) {
	if (typeof relative !== "string" || relative.includes("\0") || relative.length > 4096) {
		throw new Refusal("Bad path");
	}
	const parts = relative.split("/").filter(Boolean);
	if (parts.some((part) => part === "." || part === "..")) {
		throw new Refusal("Bad path");
	}
	const full = path.join(FILES, ...parts);
	if (full !== FILES && !full.startsWith(`${FILES}/`)) {
		throw new Refusal("Bad path");
	}
	return { full, rel: parts.join("/") };
}

async function list(relative: unknown) {
	const { full, rel } = resolveInside(relative);
	const entries: TEntry[] = [];
	for (const entry of await fsp.readdir(full, { withFileTypes: true })) {
		if (entry.name.startsWith(TEMP_PREFIX) || !(entry.isFile() || entry.isDirectory())) {
			continue;
		}
		try {
			const stats = await fsp.lstat(path.join(full, entry.name));
			entries.push({ name: entry.name, dir: stats.isDirectory(), size: stats.size, mtime: stats.mtimeMs });
		} catch {}
	}
	entries.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true }));
	return { path: rel, entries };
}

// Methods

function password(value: unknown) {
	if (typeof value !== "string" || value.length === 0 || value.length > MAX_PASSWORD) {
		throw new Refusal("Enter the password");
	}
	return value;
}

function newPassword(value: unknown) {
	if (typeof value !== "string" || value.length < MIN_PASSWORD || value.length > MAX_PASSWORD || /[\0\n\r]/.test(value)) {
		throw new Refusal(`The password needs ${MIN_PASSWORD} to ${MAX_PASSWORD} characters on one line`);
	}
	return value;
}

async function guarded<T>(address: string, action: () => Promise<T>) {
	if (blocked(address)) {
		throw new Refusal("Too many wrong passwords, try again later");
	}
	try {
		return await action();
	} catch (error) {
		if (error instanceof vault.VaultError && error.wrongPassword) {
			recordFailure(address);
		}
		throw error;
	}
}

function requireAuth(session: TSession) {
	if (!authed(session)) {
		throw new Refusal("Locked");
	}
}

async function lockVault() {
	await worker.pause();
	try {
		await vault.unmount();
	} finally {
		worker.resume();
	}
	for (const session of sessions.values()) {
		session.authed = false;
	}
	mounted();
}

// Creates each top-level folder of the import root in the inbox, never deletes or descends
async function mirrorFolders(): Promise<TMirror> {
	const result: TMirror = { created: [], existing: 0, blocked: [] };
	const entries = await fsp.readdir(path.join(FILES, IMPORT_ROOT), { withFileTypes: true }).catch(() => []);
	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) {
			continue;
		}
		const target = path.join(INBOX, entry.name);
		const existing = await fsp.lstat(target).catch(() => null);
		if (existing?.isDirectory()) {
			result.existing++;
		} else if (existing) {
			result.blocked.push(entry.name);
		} else {
			await fsp.mkdir(target, { mode: 0o700 });
			result.created.push(entry.name);
		}
	}
	result.created.sort();
	return result;
}

// approve is the delete count the user was shown, checksum compares every byte
function startMirror(params: Record<string, unknown>) {
	const approve = Number(params.approve);
	try {
		mirror.start(params.checksum === true ? "checksum" : "manual", Number.isInteger(approve) && approve > 0 ? approve : null);
	} catch (error) {
		throw new Refusal((error as Error).message);
	}
}

async function call(session: TSession, method: string, params: Record<string, unknown>): Promise<unknown> {
	switch (method) {
		case "status": {
			const unlocked = mounted();
			const status: TStatus = {
				exists: vault.exists(),
				unlocked,
				authed: authed(session),
				idleMinutes: unlocked ? idle.minutes : IDLE_MINUTES,
				idleDefault: IDLE_MINUTES,
			};
			if (status.authed) {
				status.lockIn = idle.watching ? Math.max(idle.lockAt() - Date.now(), 0) : null;
				status.activity = worker.activity;
				status.storage = await storage();
				status.schedule = schedule();
				status.mirror = mirror.status();
			}
			return status;
		}
		case "create": {
			if (vault.exists()) {
				throw new Refusal("The vault already exists");
			}
			const chosen = newPassword(params.password);
			const recoveryKey = await vault.create(chosen);
			mounted();
			session.authed = true;
			session.generation = generation;
			worker.poke();
			return { recoveryKey };
		}
		case "unlock": {
			if (!vault.exists()) {
				throw new Refusal("There is no vault yet");
			}
			const given = password(params.password);
			await guarded(session.address, () => vault.mount(given));
			mounted();
			session.authed = true;
			session.generation = generation;
			worker.poke();
			return true;
		}
		case "lock": {
			requireAuth(session);
			await lockVault();
			return true;
		}
		case "logout": {
			session.authed = false;
			return true;
		}
		case "password": {
			requireAuth(session);
			const current = password(params.current);
			const next = newPassword(params.next);
			await guarded(session.address, () => vault.changePassword(current, next));
			return true;
		}
		case "list": {
			requireAuth(session);
			return list(params.path ?? "");
		}
		case "stat": {
			requireAuth(session);
			const { full, rel } = resolveInside(params.path);
			const stats = await fsp.lstat(full);
			return { path: rel, dir: stats.isDirectory(), size: stats.size, mtime: stats.mtimeMs };
		}
		case "search": {
			requireAuth(session);
			const query = typeof params.query === "string" ? params.query.trim() : "";
			if (query.length < 2) {
				throw new Refusal("Search for at least 2 characters");
			}
			const limit = Math.min(Math.max(Number(params.limit) || 200, 1), 1000);
			return worker.catalog.search(query, limit);
		}
		case "inbox": {
			requireAuth(session);
			return worker.inboxList;
		}
		case "events": {
			requireAuth(session);
			const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
			return worker.events.slice(0, limit);
		}
		case "schedule": {
			requireAuth(session);
			return schedule();
		}
		case "setSchedule": {
			requireAuth(session);
			let windows: ReturnType<typeof validate>;
			try {
				windows = validate(params.windows);
			} catch (error) {
				throw new Refusal((error as Error).message);
			}
			worker.schedule.set(windows);
			return schedule();
		}
		case "checkNow": {
			requireAuth(session);
			worker.checkNow();
			return true;
		}
		case "seed": {
			requireAuth(session);
			return worker.restartSeed();
		}
		case "setIdleTimeout": {
			requireAuth(session);
			const minutes = Number(params.minutes);
			if (!Number.isFinite(minutes)) {
				throw new Refusal("Minutes must be a number");
			}
			idle.set(minutes);
			return { minutes: idle.minutes, lockIn: idle.watching ? idle.lockAt() - Date.now() : null };
		}
		case "mirror": {
			requireAuth(session);
			return mirror.status();
		}
		case "mirrorSync": {
			requireAuth(session);
			startMirror(params);
			return mirror.status();
		}
		case "mirrorCancel": {
			requireAuth(session);
			try {
				mirror.cancel();
			} catch (error) {
				throw new Refusal((error as Error).message);
			}
			return mirror.status();
		}
		case "mirrorFolders": {
			requireAuth(session);
			return mirrorFolders();
		}
		default:
			throw new Refusal("Unknown method");
	}
}

// HTTP

const app = express();
app.disable("x-powered-by");
app.set("etag", false);

app.use((req, res, next) => {
	if (!isAllowed(remoteAddress(req))) {
		res.status(403).end();
		return;
	}
	res.setHeader(
		"Content-Security-Policy",
		"default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
	);
	res.setHeader("X-Content-Type-Options", "nosniff");
	res.setHeader("Referrer-Policy", "no-referrer");
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
	next();
});

app.use("/api", (_req, res, next) => {
	res.setHeader("Cache-Control", "no-store");
	next();
});

app.get("/api/key", (_req, res) => {
	res.json({ pub: serverKey.pub.toString("base64") });
});

app.post("/api/session", express.json({ limit: "1kb" }), (req, res) => {
	const clientPub = typeof req.body?.pub === "string" ? Buffer.from(req.body.pub, "base64") : Buffer.alloc(0);
	const key = deriveSessionKey(serverKey, clientPub);
	if (!key) {
		res.status(400).end();
		return;
	}
	if (sessions.size >= MAX_SESSIONS) {
		const oldest = [...sessions.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
		sessions.delete(oldest[0]);
	}
	const id = randomBytes(18).toString("base64url");
	sessions.set(id, {
		key,
		address: remoteAddress(req),
		seen: new Set(),
		highest: 0,
		authed: false,
		generation: -1,
		lastSeen: Date.now(),
	});
	res.json({ id });
});

const raw = express.raw({ type: "application/octet-stream", limit: "64kb" });

// Opens a sealed request and rejects any request number used before
function openRequest(req: Request, res: Response) {
	const session = sessions.get(String(req.headers["x-session"] ?? ""));
	if (!session) {
		res.status(401).end();
		return null;
	}
	const plain = Buffer.isBuffer(req.body) ? open(session.key, "c>s", req.body) : null;
	let request: TRequest;
	try {
		request = JSON.parse(plain?.toString("utf-8") ?? "");
	} catch {
		res.status(400).end();
		return null;
	}
	const n = request.n;
	if (!Number.isSafeInteger(n) || n <= 0 || session.seen.has(n) || n < session.highest - 1000) {
		res.status(400).end();
		return null;
	}
	session.seen.add(n);
	session.highest = Math.max(session.highest, n);
	if (session.seen.size > 2000) {
		for (const old of session.seen) {
			if (old < session.highest - 1000) {
				session.seen.delete(old);
			}
		}
	}
	session.lastSeen = Date.now();
	return { session, request };
}

function reply(res: Response, session: TSession, response: TResponse) {
	res.type("application/octet-stream").send(seal(session.key, `s>c:${response.n}`, Buffer.from(JSON.stringify(response))));
}

app.post("/api/rpc", raw, async (req, res) => {
	const opened = openRequest(req, res);
	if (!opened) {
		return;
	}
	const { session, request } = opened;
	try {
		const result = await call(session, String(request.m), request.p ?? {});
		reply(res, session, { n: request.n, ok: true, r: result });
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === "ENOENT" || (error as NodeJS.ErrnoException)?.code === "ENOTDIR") {
			reply(res, session, { n: request.n, ok: false, e: "Not found" });
			return;
		}
		const known = error instanceof Refusal || error instanceof vault.VaultError;
		if (!known) {
			console.error(`${request.m} failed`, error instanceof Error ? error.name : "");
		}
		reply(res, session, { n: request.n, ok: false, e: known ? (error as Error).message : "Something went wrong" });
	}
});

// Part of a file, sealed as raw bytes so nothing is base64 encoded
app.post("/api/read", raw, async (req, res) => {
	const opened = openRequest(req, res);
	if (!opened) {
		return;
	}
	const { session, request } = opened;
	const params = request.p ?? {};
	const offset = Number(params.offset);
	const length = Math.min(Number(params.length), CHUNK_BYTES);
	if (!authed(session) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length <= 0) {
		res.status(403).end();
		return;
	}
	let handle: fsp.FileHandle | null = null;
	try {
		const { full } = resolveInside(params.path);
		handle = await fsp.open(full, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
		const buffer = Buffer.alloc(length);
		const { bytesRead } = await handle.read(buffer, 0, length, offset);
		res.type("application/octet-stream").send(seal(session.key, `s>c:${request.n}:data`, buffer.subarray(0, bytesRead)));
	} catch {
		res.status(404).end();
	} finally {
		await handle?.close();
	}
});

app.use(express.static(DIST, { index: "index.html", maxAge: 0 }));

app.listen(PORT, HOST, () => {
	console.log(`Vault listening on ${HOST}:${PORT}, state in ${STATE}`);
	worker.start();
	if (MIRROR_ENABLED) {
		mirror.startScheduler();
	}
});

// Localhost only, for the dashboard's agent, which reads this token through its sudo rule for vault
const CONTROL_TOKEN_FILE = path.join(STATE, "control-token");
if (!fs.existsSync(CONTROL_TOKEN_FILE)) {
	fs.writeFileSync(CONTROL_TOKEN_FILE, randomBytes(32).toString("hex"), { mode: 0o600 });
}
const controlToken = Buffer.from(fs.readFileSync(CONTROL_TOKEN_FILE, "utf-8").trim());

const control = http.createServer((req, res) => {
	const given = Buffer.from(String(req.headers["x-vault-control"] ?? ""));
	const reply = (code: number, body: unknown) => {
		res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
		res.end(JSON.stringify(body));
	};
	if (given.length !== controlToken.length || !timingSafeEqual(given, controlToken)) {
		reply(401, { error: "Unauthorized" });
		return;
	}
	let body = "";
	req.on("data", (chunk) => {
		body += chunk;
		if (body.length > 4096) {
			req.destroy();
		}
	});
	req.on("end", () => {
		try {
			const params = body ? JSON.parse(body) : {};
			if (req.method === "GET" && req.url === "/mirror") {
				reply(200, mirror.status());
			} else if (req.method === "POST" && req.url === "/mirror/sync") {
				startMirror(params);
				reply(200, mirror.status());
			} else if (req.method === "POST" && req.url === "/mirror/cancel") {
				mirror.cancel();
				reply(200, mirror.status());
			} else {
				reply(404, { error: "Not found" });
			}
		} catch (error) {
			reply(409, { error: error instanceof Error ? error.message : "Failed" });
		}
	});
});
control.listen(CONTROL_PORT, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		mirror.stop();
		void worker.pause().finally(() => process.exit(0));
	});
}
