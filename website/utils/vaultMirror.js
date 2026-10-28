import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sendBotNotification } from "./utils.js";

// The vault mirror runs inside the vault service, this asks its localhost control port and announces changes

const run = promisify(execFile);

const CONTROL = "http://127.0.0.1:7901";
const TOKEN_FILE = "/var/lib/vault/control-token";
const POLL = 30 * 1000;
// Silence that long means the dashboard can't tell whether the mirror works
const UNREACHABLE_AFTER = 5 * 60 * 1000;

let token = null;
let cached = null;
let lastReached = Date.now();
let lastSeen = undefined;
let watching = false;

// Only vault can read the token, the agent gets it through its sudo rule for vault
async function readToken() {
	const { stdout } = await run("sudo", ["-n", "-u", "vault", "cat", TOKEN_FILE], { timeout: 10000 });
	return stdout.trim();
}

async function request(method, route, body) {
	for (let attempt = 0; attempt < 2; attempt++) {
		token ??= await readToken();
		const response = await fetch(`${CONTROL}${route}`, {
			method,
			headers: { "x-vault-control": token, "Content-Type": "application/json" },
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(10000),
		});
		// A recreated state folder means a new token
		if (response.status === 401 && attempt === 0) {
			token = null;
			continue;
		}
		const data = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(data?.error ?? `The vault service answered ${response.status}`);
		cached = data;
		lastReached = Date.now();
		announce(data);
		return data;
	}
	throw new Error("The vault service refused the control token");
}

// Only changes are announced, a mirror that keeps working stays quiet
function announce(status) {
	const current = status.lastCompleted;
	const id = current?.startedAt ?? null;
	if (lastSeen === undefined) {
		lastSeen = { id, run: current };
		return;
	}
	if (id === lastSeen.id) return;
	const previous = lastSeen.run;
	lastSeen = { id, run: current };
	if (!current) return;

	const wasOk = previous ? previous.ok : true;
	if (current.held && !previous?.held) {
		sendBotNotification({
			title: "Vault backup is waiting",
			body: `The vault mirror would delete ${current.held.deletes.toLocaleString()} files from ${status.dest}, more than the ${current.held.limit.toLocaleString()} it may remove on its own. Nothing was changed. Approve it on the server page or in the vault if that is expected.`,
		});
	} else if (!current.ok && !current.held && wasOk) {
		sendBotNotification({ title: "Vault backup failed", body: `${current.error}. Details are on the server page.` });
	} else if (current.ok && previous && !previous.ok) {
		sendBotNotification({ title: "Vault backup is working again", body: `The vault mirror synced to ${status.dest}.` });
	}
}

export async function getVaultMirrorStatus() {
	try {
		return await request("GET", "/mirror");
	} catch (error) {
		if (cached) return { ...cached, unreachable: error.message };
		throw error;
	}
}

// approve is the delete count shown to the owner, checksum compares every byte
export const startVaultMirror = ({ approve = null, checksum = false } = {}) => request("POST", "/mirror/sync", { approve, checksum });

export const cancelVaultMirror = () => request("POST", "/mirror/cancel");

// Synchronous for the health check, so it reads what the last poll saw
export function getVaultMirrorHealth(now = Date.now()) {
	if (!watching) return { ok: true, reason: null };
	if (now - lastReached > UNREACHABLE_AFTER) {
		return { ok: false, reason: "The vault service is not answering, so the vault backup can't be checked" };
	}
	return cached?.health ?? { ok: true, reason: null };
}

export function startVaultMirrorWatch() {
	watching = true;
	lastReached = Date.now();
	const poll = () => request("GET", "/mirror").catch(() => {});
	setTimeout(poll, 10 * 1000);
	setInterval(poll, POLL);
}
