import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VPN_DIR = process.env.PROTONVPN_DIR ?? "/media/T7/ProtonVPN";
const LOG_FILE = path.join(__dirname, "../data/vpn-switch.log");
const STATE_FILE = path.join(__dirname, "../data/vpn-switch.json");
// Same as available() in switch.sh, everything after the first underscore. Dotfiles like macOS ._ copies are skipped
const CONFIG_NAME = /^[^._][^_]*_(.+)\.conf$/;
const EXIT_LINE = /^__exit (\d+)$/m;

export function listVpnConfigs() {
	return fs
		.readdirSync(VPN_DIR)
		.map((name) => name.match(CONFIG_NAME)?.[1])
		.filter(Boolean)
		.sort();
}

export async function currentVpnConfig() {
	try {
		const { stdout } = await run(path.join(VPN_DIR, "current.sh"), {
			timeout: 20000,
		});
		return { current: stdout.trim() || null, error: null };
	} catch (error) {
		return { current: null, error: error.stdout?.trim() || error.message };
	}
}

function alive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export function getSwitchStatus() {
	let state = null;
	try {
		state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
	} catch {
		return { running: false };
	}
	const log = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, "utf-8") : "";
	const exit = log.match(EXIT_LINE);
	const lines = log.split("\n").filter((line) => line && !EXIT_LINE.test(line));
	const running = !exit && alive(state.pid);
	return {
		running,
		suffix: state.suffix,
		startedAt: state.startedAt,
		ok: exit ? exit[1] === "0" : running ? null : false,
		message:
			lines.at(-1) ?? (running ? "Starting..." : "Stopped without output"),
	};
}

// Detached with output in a file, so a site restart mid switch cannot cut it off halfway
export function startVpnSwitch(suffix) {
	if (!listVpnConfigs().includes(suffix)) throw new Error("Unknown VPN config");
	if (getSwitchStatus().running)
		throw new Error("A VPN switch is already running");

	const out = fs.openSync(LOG_FILE, "w");
	const child = spawn(
		"bash",
		[
			"-c",
			'"$0" "$1"; echo "__exit $?"',
			path.join(VPN_DIR, "switch.sh"),
			suffix,
		],
		{
			cwd: VPN_DIR,
			detached: true,
			stdio: ["ignore", out, out],
		},
	);
	fs.closeSync(out);
	child.unref();
	fs.writeFileSync(
		STATE_FILE,
		JSON.stringify({ suffix, pid: child.pid, startedAt: Date.now() }),
	);
	console.log(`Switching the VPN to ${suffix}`);
	return getSwitchStatus();
}
