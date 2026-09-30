import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sendBotNotification } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Survives restarts, so a link handed out stays good for its full lifetime
const STATE_FILE = path.join(__dirname, "../data/server-share.json");

export const SHARE_LIFETIME = 8 * 60 * 60 * 1000;
export const VIEW_COOKIE = "server_view";

// Four digits is only 10,000 guesses, so guessing is capped hard. Per address
// first, then a global cap that shuts PIN entry off for everyone
const IP_WINDOW = 15 * 60 * 1000;
const IP_MAX_FAILURES = 5;
const GLOBAL_WINDOW = 60 * 60 * 1000;
const GLOBAL_MAX_FAILURES = 20;

let failures = [];
let lockedUntil = 0;

function hash(value) {
	return createHash("sha256").update(String(value)).digest("hex");
}

function readState() {
	try {
		const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
		const now = Date.now();
		return {
			codes: (state.codes ?? []).filter((code) => code.expiresAt > now),
			sessions: (state.sessions ?? []).filter((session) => session.expiresAt > now),
		};
	} catch {
		return { codes: [], sessions: [] };
	}
}

// The PINs are kept so the owner can see them again, and nothing else can
// read this file
function writeState(state) {
	fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
	fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 4), { mode: 0o600 });
	fs.chmodSync(STATE_FILE, 0o600);
}

export function createShareCode() {
	const state = readState();
	const taken = new Set(state.codes.map((code) => code.pin));

	let pin;
	do {
		pin = String(randomInt(0, 10000)).padStart(4, "0");
	} while (taken.has(pin));

	const code = { pin, createdAt: Date.now(), expiresAt: Date.now() + SHARE_LIFETIME };
	writeState({ ...state, codes: [...state.codes, code] });
	return code;
}

export function activeShareCodes() {
	return readState().codes.map(({ pin, createdAt, expiresAt }) => ({ pin, createdAt, expiresAt }));
}

// Ends every code and every view session made from one
export function stopSharing() {
	writeState({ codes: [], sessions: [] });
}

function pinMatches(a, b) {
	return timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
}

// Swaps a PIN for a random session token. The session ends when the code it
// came from would have, so opening a link late does not extend it
export function redeemPin(pin, ip) {
	const now = Date.now();
	failures = failures.filter((failure) => now - failure.at < GLOBAL_WINDOW);

	if (now < lockedUntil) {
		return { error: "Share codes are paused after too many wrong attempts, try again later" };
	}

	const fromIp = failures.filter((failure) => failure.ip === ip && now - failure.at < IP_WINDOW);
	if (fromIp.length >= IP_MAX_FAILURES) {
		return { error: "Too many wrong codes, try again in 15 minutes" };
	}

	const state = readState();
	const code = /^\d{4}$/.test(String(pin)) ? state.codes.find((entry) => pinMatches(entry.pin, pin)) : null;

	if (!code) {
		failures.push({ ip, at: now });
		if (failures.length >= GLOBAL_MAX_FAILURES) {
			lockedUntil = now + GLOBAL_WINDOW;
			failures = [];
			sendBotNotification({
				title: "Server share codes paused",
				body: `${GLOBAL_MAX_FAILURES} wrong share codes were tried within an hour, the last from ${ip}. Share links are off for an hour.`,
			});
		}
		return { error: "That share code is wrong or has expired" };
	}

	const token = randomBytes(32).toString("hex");
	writeState({
		...state,
		sessions: [...state.sessions, { tokenHash: hash(token), expiresAt: code.expiresAt }],
	});
	return { token, expiresAt: code.expiresAt };
}

export function viewSession(req) {
	const token = req.cookies?.[VIEW_COOKIE];
	if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
	const tokenHash = hash(token);
	const session = readState().sessions.find((entry) => entry.tokenHash === tokenHash);
	return session ? { expiresAt: session.expiresAt } : null;
}
