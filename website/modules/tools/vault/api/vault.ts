import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { IDLE_MAX } from "../shared/protocol";
import { AGE_KEY, AGE_PUB, ALLOW_OTHER, CIPHER, EXTPASS, FILES, META, MOUNT, TMP } from "./config";

// Drives gocryptfs and age, passwords go on stdin or in one child's environment, never in arguments other users could see

type TRun = { code: number; stdout: string; stderr: string };

// Node hands children a socket rather than a pipe, which /dev/stdin cannot open, so passwords are read from plain stdin
function run(command: string, args: string[], input?: string, env?: Record<string, string>, daemon = false): Promise<TRun> {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			stdio: ["pipe", "pipe", "pipe"],
			env: { PATH: "/usr/bin:/bin", HOME: process.env.HOME ?? "/", ...env },
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (data) => {
			stdout += data;
		});
		child.stderr.on("data", (data) => {
			stderr += data;
		});
		child.on("error", (error) => resolve({ code: -1, stdout, stderr: String(error) }));
		// A daemon keeps the output pipes open after its parent exits, so it is done at exit rather than close
		child.on(daemon ? "exit" : "close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
		child.stdin.on("error", () => {});
		child.stdin.end(input ?? "");
	});
}

const lastLine = (text: string) => text.trim().split("\n").pop() || "unknown error";

// gocryptfs exits with 12 for a wrong password
const WRONG_PASSWORD = 12;

export class VaultError extends Error {
	constructor(
		message: string,
		readonly wrongPassword = false,
	) {
		super(message);
	}
}

export function exists() {
	return fs.existsSync(path.join(CIPHER, "gocryptfs.conf"));
}

export function isMounted() {
	try {
		return fs
			.readFileSync("/proc/self/mounts", "utf-8")
			.split("\n")
			.some((line) => {
				const [, target, type] = line.split(" ");
				return target === MOUNT && type === "fuse.gocryptfs";
			});
	} catch {
		return false;
	}
}

// The recovery key gocryptfs would print, eight groups of eight hex digits
function formatKey(hex: string) {
	return hex.match(/.{8}/g)?.join("-") ?? hex;
}

async function masterKey(password: string) {
	const result = await run("gocryptfs-xray", ["-dumpmasterkey", path.join(CIPHER, "gocryptfs.conf")], `${password}\n`);
	if (result.code === WRONG_PASSWORD) {
		throw new VaultError("Wrong password", true);
	}
	const key = result.stdout.trim();
	if (result.code !== 0 || !/^[0-9a-f]{64}$/.test(key)) {
		throw new VaultError("Could not read the vault's key");
	}
	return key;
}

export async function checkPassword(password: string) {
	await masterKey(password);
}

export async function mount(password: string) {
	if (isMounted()) {
		await checkPassword(password);
		return;
	}
	// allow_other lets the Samba share in, the long idle timeout only catches a server that died
	const result = await run(
		"gocryptfs",
		["-q", ...(ALLOW_OTHER ? ["-allow_other"] : []), "-i", `${IDLE_MAX + 15}m`, CIPHER, MOUNT],
		`${password}\n`,
		undefined,
		true,
	);
	if (result.code === WRONG_PASSWORD) {
		throw new VaultError("Wrong password", true);
	}
	if (result.code !== 0 || !isMounted()) {
		throw new VaultError(`Could not unlock: ${lastLine(result.stderr)}`);
	}
}

export async function unmount() {
	if (!isMounted()) {
		return;
	}
	let result = await run("fusermount", ["-u", MOUNT]);
	if (result.code !== 0) {
		// Something still has a file open, it locks the moment that closes
		result = await run("fusermount", ["-u", "-z", MOUNT]);
	}
	if (result.code !== 0 && isMounted()) {
		throw new VaultError("Could not lock the vault");
	}
}

export async function create(password: string) {
	if (exists()) {
		throw new VaultError("The vault already exists");
	}
	fs.mkdirSync(CIPHER, { recursive: true });
	if (fs.readdirSync(CIPHER).length > 0) {
		throw new VaultError("The vault folder is not empty");
	}
	const init = await run("gocryptfs", ["-init", "-q", CIPHER], `${password}\n`);
	if (init.code !== 0) {
		throw new VaultError(`Could not create the vault: ${lastLine(init.stderr)}`);
	}
	const key = await masterKey(password);
	await mount(password);
	fs.mkdirSync(FILES, { recursive: true, mode: 0o700 });
	await ensureAgeKey();
	return formatKey(key);
}

// The private key lives inside the vault, so pending files can only be opened while it is unlocked
export async function ensureAgeKey() {
	fs.mkdirSync(META, { recursive: true, mode: 0o700 });
	if (fs.existsSync(AGE_KEY)) {
		const pub = await run("age-keygen", ["-y", AGE_KEY]);
		if (pub.code === 0 && pub.stdout.trim()) {
			fs.writeFileSync(AGE_PUB, `${pub.stdout.trim()}\n`, { mode: 0o600 });
		}
		return;
	}
	const generated = await run("age-keygen", ["-o", AGE_KEY]);
	const pub = generated.stderr.match(/age1[0-9a-z]+/)?.[0];
	if (generated.code !== 0 || !pub) {
		throw new VaultError("Could not create the inbox key");
	}
	fs.writeFileSync(AGE_PUB, `${pub}\n`, { mode: 0o600 });
}

export async function changePassword(current: string, next: string) {
	// gocryptfs asks its extpass program twice, the script answers with the current then the new password
	fs.mkdirSync(TMP, { recursive: true, mode: 0o700 });
	const step = path.join(TMP, `step-${randomBytes(8).toString("hex")}`);
	try {
		const result = await run("gocryptfs", ["-passwd", "-extpass", EXTPASS, CIPHER], "", {
			VAULT_STEP: step,
			VAULT_OLD: current,
			VAULT_NEW: next,
		});
		if (result.code === WRONG_PASSWORD) {
			throw new VaultError("Wrong password", true);
		}
		if (result.code !== 0) {
			throw new VaultError("Could not change the password");
		}
	} finally {
		fs.rmSync(step, { force: true });
	}
}

export async function shred(file: string) {
	// One pass of random data over the file's blocks, then it is renamed and removed
	const result = await run("shred", ["-n", "1", "-u", "--", file]);
	if (result.code !== 0) {
		throw new Error("shred failed");
	}
}

export async function ageSeal(source: string, target: string, recipient: string) {
	const result = await run("age", ["-r", recipient, "-o", target, "--", source]);
	if (result.code !== 0) {
		throw new Error("age could not seal a file");
	}
}

export async function ageSealText(text: string, target: string, recipient: string) {
	const result = await run("age", ["-r", recipient, "-o", target], text);
	if (result.code !== 0) {
		throw new Error("age could not seal a file");
	}
}

export async function ageOpen(source: string, target: string) {
	const result = await run("age", ["-d", "-i", AGE_KEY, "-o", target, "--", source]);
	if (result.code !== 0) {
		throw new Error("age could not open a pending file");
	}
}

export async function ageOpenText(source: string) {
	const result = await run("age", ["-d", "-i", AGE_KEY, "--", source]);
	if (result.code !== 0) {
		throw new Error("age could not open a pending file");
	}
	return result.stdout;
}

export async function diskUsage(folder: string) {
	const result = await run("du", ["-sb", folder]);
	const bytes = Number(result.stdout.split("\t")[0]);
	return Number.isFinite(bytes) ? bytes : null;
}
