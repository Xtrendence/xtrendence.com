import { execFile, spawn } from "node:child_process";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { AGENT_SOCKET } from "./agentClient.js";
import {
	getBackupStatus,
	listBackupDrives,
	planBackup,
	setBackupDrive,
	startBackup,
} from "./backups.js";
import { getHistory, getSnapshot, getTimeline } from "./history.js";
import {
	LIMITS as RECOVERY_LIMITS,
	getRecoverySettings,
	getRecoveryStatus,
	lights as lightsApi,
	listPlugs,
	parseRecoverySettings,
	saveRecoverySettings,
} from "./internetRecovery.js";
import {
	cancelDrill,
	drillRunning,
	getDrillStatus,
	startDrill,
} from "./restoreDrill.js";
import { getHealingStatus, restartCloudflared } from "./selfHealing.js";
import {
	checkNow,
	getAlertStatus,
	getRules,
	saveRules,
	sendNotificationNow,
} from "./serverAlerts.js";
import {
	collectServerStats,
	forgetVpn,
	getVpn,
	listContainers,
	listMounts,
	listServices,
	restartContainer,
	restartService,
	restartVpn,
} from "./serverStats.js";
import { helper, helperSync, sendBotNotification } from "./utils.js";
import {
	currentVpnConfig,
	getSwitchStatus,
	listVpnConfigs,
	startVpnSwitch,
} from "./vpnExit.js";
import { cancelVaultMirror, getVaultMirrorStatus, startVaultMirror } from "./vaultMirror.js";
import { createProfile, getProfileConfig, getProfileQr, removeProfile } from "./vpnProfiles.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runFile = promisify(execFile);

// A request is a method name and its arguments, nothing bigger is expected
const MAX_REQUEST = 1024 * 1024;

// Carries the HTTP status the web process should answer with
class AgentError extends Error {
	constructor(message, status) {
		super(message);
		this.status = status;
	}
}

// Switches the media apps between their stock look and the Liquid Glass theme
const TOGGLE_THEME = "/media/T7/Media Stack/toggle-theme.sh";

// Each app's theme state, parsed from lines like "Seerr theme: Liquid Glass"
async function themeStatus(action) {
	const { stdout } = await runFile(TOGGLE_THEME, ["all", action], { timeout: 15000 });
	const apps = stdout
		.split("\n")
		.map((line) => line.match(/^(.+) theme: (Liquid Glass|stock)/))
		.filter(Boolean)
		.map(([, name, state]) => ({ name, on: state === "Liquid Glass" }));
	return { apps, on: apps.length > 0 && apps.every((app) => app.on) };
}

// The yahoo-finance2 upgrade buttons in plutus and smahunter. Those apps run as apps and cannot write their own
// folders, so their exact upgrade runs here as the owner, with pm2 pointing at the apps user's (see harden.sh)
const APPS_PM2_BIN = "/usr/local/lib/apps-pm2";
const UPGRADES = {
	plutus: {
		dir: path.join(__dirname, "../modules/tools/plutus"),
		command: "pnpm remove yahoo-finance2 && pnpm add yahoo-finance2 && pm2 restart plutus",
	},
	smahunter: {
		dir: path.join(__dirname, "../modules/tools/smahunter"),
		command: 'echo "=== yahoo-finance2 upgrade started $(date) ===" && pnpm add yahoo-finance2@latest && pnpm run build-prod',
		// The app shows its progress from this file
		log: "logs/upgrade.log",
	},
};
const upgrading = new Set();

function upgradeYahoo({ app }) {
	const name = String(app ?? "");
	if (!Object.hasOwn(UPGRADES, name)) throw new AgentError("Unknown app", 400);
	if (upgrading.has(name)) return { status: "already-running" };

	const upgrade = UPGRADES[name];
	const out = upgrade.log ? fs.openSync(path.join(upgrade.dir, upgrade.log), "a") : "inherit";
	// Detached so it outlives the pm2 restart at the end, and an agent restart
	const child = spawn("bash", ["-c", upgrade.command], {
		cwd: upgrade.dir,
		detached: true,
		stdio: ["ignore", out, out],
		env: { ...process.env, PATH: `${APPS_PM2_BIN}:${process.env.PATH}` },
	});
	if (typeof out === "number") fs.closeSync(out);
	upgrading.add(name);
	child.on("exit", (code) => {
		upgrading.delete(name);
		console.log(`${name} yahoo-finance2 upgrade finished with code ${code}`);
	});
	child.unref();
	console.log(`${name} yahoo-finance2 upgrade started`);
	return { status: "started" };
}

// What the name lists on the alert rules can pick from
async function listChoices() {
	const [containers, mounts, services] = await Promise.all([listContainers(), listMounts(), listServices()]);
	return {
		containers,
		mounts: mounts.map((entry) => entry.mount).filter((mount) => mount !== "/"),
		services,
	};
}

// Asked for before a VPN QR code is shown. Only a scrypt hash is kept, in data, which the web process cannot read,
// so the check holds even if the web process is compromised
const PASSWORD_FILE = path.join(__dirname, "../data/server-password.json");

function serverPasswordMatches(attempt) {
	let saved;
	try {
		saved = JSON.parse(fs.readFileSync(PASSWORD_FILE, "utf-8"));
	} catch {
		return false;
	}
	const expected = Buffer.from(saved.hash, "hex");
	const actual = scryptSync(String(attempt ?? ""), Buffer.from(saved.salt, "hex"), expected.length, {
		N: saved.N,
		r: saved.r,
		p: saved.p,
	});
	return timingSafeEqual(actual, expected);
}

function saveServerPasswordHash(password) {
	const salt = randomBytes(16);
	const params = { N: 16384, r: 8, p: 1 };
	const hash = scryptSync(password, salt, 32, params);
	fs.writeFileSync(
		PASSWORD_FILE,
		JSON.stringify({ salt: salt.toString("hex"), hash: hash.toString("hex"), ...params }, null, 4),
		{ mode: 0o600 },
	);
}

const PASSWORD_MAX_FAILURES = 3;
const PASSWORD_LOCKOUT = 12 * 60 * 60 * 1000;
// Wrong attempts survive agent restarts, a correct current password clears them
const PASSWORD_FAILURES_FILE = path.join(__dirname, "../data/password-failures.json");

function readPasswordFailures() {
	try {
		const times = JSON.parse(fs.readFileSync(PASSWORD_FAILURES_FILE, "utf-8"));
		return Array.isArray(times) ? times.filter((time) => Number.isFinite(time) && Date.now() - time < PASSWORD_LOCKOUT) : [];
	} catch {
		return [];
	}
}

function writePasswordFailures(times) {
	fs.writeFileSync(PASSWORD_FAILURES_FILE, JSON.stringify(times), { mode: 0o600 });
}

function lockoutLeft(times) {
	const left = times[0] + PASSWORD_LOCKOUT - Date.now();
	const hours = Math.floor(left / 3600000);
	const minutes = Math.ceil((left % 3600000) / 60000);
	return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

// The login password sudo and SSH use, the Samba password and the VPN QR code password, all at once.
// The helper checks the current password itself, so even the agent cannot change it without knowing it
// TigerVNC reads this file at every login, so the desktop picks up a new password without a restart.
// VNC authentication only ever uses the first 8 characters
const VNC_PASSWD = path.join(process.env.HOME ?? "", ".vnc", "passwd");

async function saveVncPassword(password) {
	const encrypted = await new Promise((resolve, reject) => {
		const child = spawn("vncpasswd", ["-f"], { stdio: ["pipe", "pipe", "pipe"] });
		const chunks = [];
		child.stdout.on("data", (chunk) => chunks.push(chunk));
		child.on("error", reject);
		child.on("close", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`vncpasswd exited with ${code}`))));
		child.stdin.end(`${password}\n`);
	});
	if (encrypted.length !== 8) throw new Error("vncpasswd gave an unexpected result");
	fs.mkdirSync(path.dirname(VNC_PASSWD), { recursive: true, mode: 0o700 });
	const temp = `${VNC_PASSWD}.${randomBytes(4).toString("hex")}`;
	fs.writeFileSync(temp, encrypted, { mode: 0o600 });
	fs.renameSync(temp, VNC_PASSWD);
}

async function changePassword({ current, next, ip }) {
	let passwordFailures = readPasswordFailures();
	if (passwordFailures.length >= PASSWORD_MAX_FAILURES) {
		throw new AgentError(`Too many wrong passwords, try again in ${lockoutLeft(passwordFailures)}`, 429);
	}

	const oldPassword = String(current ?? "");
	const newPassword = String(next ?? "");
	if (!oldPassword) throw new AgentError("Enter the current password", 400);
	if (newPassword === oldPassword) throw new AgentError("The new password is the same as the current one", 400);
	if (/[\n\r]/.test(oldPassword) || /[\n\r]/.test(newPassword)) throw new AgentError("Passwords cannot contain line breaks", 400);

	let result;
	try {
		result = JSON.parse(
			helperSync(["change-password"], { input: `${oldPassword}\n${newPassword}\n`, timeout: 60000 }),
		);
	} catch (error) {
		const message = String(error?.stderr ?? "").trim() || "Could not change the password";
		if (error?.status === 3) {
			passwordFailures = [...passwordFailures, Date.now()];
			writePasswordFailures(passwordFailures);
			const left = PASSWORD_MAX_FAILURES - passwordFailures.length;
			console.log(`Wrong current password for a password change from ${ip}`);
			sendBotNotification({
				title: "Password change refused",
				body: `A wrong current password was entered to change the server password from ${ip}. ${left ? `${left} attempts left before a 12 hour lockout.` : "Password changes are locked for 12 hours."}`,
			});
			throw new AgentError(left ? `Wrong password, ${left} attempts left` : "Wrong password, locked for 12 hours", 403);
		}
		// The current password was right, the new one was refused
		writePasswordFailures([]);
		if (error?.status === 4) throw new AgentError(message, 400);
		console.error("Password change failed:", message);
		throw new AgentError(message, 500);
	}

	writePasswordFailures([]);
	let vpnQr = true;
	try {
		saveServerPasswordHash(newPassword);
	} catch (error) {
		vpnQr = false;
		console.error("Could not save the VPN QR code password:", error.message);
	}

	let vnc = true;
	try {
		await saveVncPassword(newPassword);
	} catch (error) {
		vnc = false;
		console.error("Could not save the VNC password:", error.message);
	}

	const changed = { login: true, ssh: true, samba: result.samba, sambaUser: result.sambaUser, vpnQr, vnc };
	console.log(`Server password changed from ${ip}, Samba ${changed.samba ? "updated" : "not updated"}`);
	sendBotNotification({
		title: "Server password changed",
		body: `The server password was changed from ${ip}. Login, sudo and SSH use it now${changed.samba ? ", and so does Samba" : ", but Samba could not be updated"}${changed.vpnQr ? "" : ", and the VPN QR code password could not be saved"}${changed.vnc ? "" : ". The VNC password could not be updated"}.`,
	});
	return { changed };
}

const QR_MAX_FAILURES = 5;
const QR_LOCKOUT = 15 * 60 * 1000;
let qrFailures = [];

// The QR code and the .conf both hold the private key, so they share one password check and lockout
function checkProfilePassword(password, ip, what) {
	qrFailures = qrFailures.filter((time) => Date.now() - time < QR_LOCKOUT);
	if (qrFailures.length >= QR_MAX_FAILURES) {
		const minutes = Math.ceil((qrFailures[0] + QR_LOCKOUT - Date.now()) / 60000);
		throw new AgentError(`Too many wrong passwords, try again in ${minutes} min`, 429);
	}

	if (!serverPasswordMatches(password)) {
		qrFailures.push(Date.now());
		console.log(`Wrong server password for a VPN ${what} from ${ip}`);
		sendBotNotification({
			title: `VPN ${what} refused`,
			body: `A wrong server password was entered for a VPN ${what} from ${ip}. ${QR_MAX_FAILURES - qrFailures.length} attempts left before a 15 minute lockout.`,
		});
		throw new AgentError("Wrong password", 403);
	}

	qrFailures = [];
}

async function profileQr({ id, password, ip }) {
	checkProfilePassword(password, ip, "QR code");
	try {
		const { name, svg } = await getProfileQr(String(id ?? ""));
		console.log(`Showed the VPN QR code for ${name}`);
		return { name, svg };
	} catch (error) {
		throw new AgentError(error.message, 400);
	}
}

async function profileConf({ id, password, ip }) {
	checkProfilePassword(password, ip, "profile download");
	try {
		const { name, config } = await getProfileConfig(String(id ?? ""));
		console.log(`Downloaded the VPN profile ${name}`);
		return { name, config };
	} catch (error) {
		throw new AgentError(error.message, 400);
	}
}

// Every method the web process can call. Arguments come from the web process, so each one is coerced here
const METHODS = {
	stats: async () => ({ ...(await collectServerStats()), alerts: getAlertStatus() }),
	timeline: ({ range }) => getTimeline(String(range ?? "24h")),
	snapshot: ({ t }) => {
		const time = Number(t);
		if (!Number.isFinite(time)) throw new AgentError("Expected a time", 400);
		return getSnapshot(time) ?? null;
	},
	history: ({ range }) => getHistory(String(range ?? "24h")),
	healing: () => getHealingStatus(),

	alerts: async () => ({ rules: getRules(), status: getAlertStatus(), choices: await listChoices() }),
	// Saving runs a check straight away so the light reflects the new rules
	saveAlertRules: async ({ rules }) => {
		try {
			saveRules(rules);
		} catch (error) {
			throw new AgentError(error.message, 400);
		}
		const status = await checkNow({ fresh: true });
		return { rules: getRules(), status, choices: await listChoices() };
	},
	checkAlerts: async () => ({ status: await checkNow({ fresh: true }) }),
	notifyAlerts: async () => {
		const result = await sendNotificationNow();
		return { sent: Boolean(result.sent), status: getAlertStatus() };
	},

	// Rechecks after, so the page and light catch up
	restartVpn: async () => {
		try {
			await restartVpn();
		} catch (error) {
			console.error("Error restarting the VPN:", error);
			throw new AgentError("Failed to restart the VPN", 500);
		}
		const status = await checkNow({ fresh: true });
		return { vpn: await getVpn(), status };
	},
	vpnExit: async ({ statusOnly }) => {
		const switching = getSwitchStatus();
		if (statusOnly) return { switching };
		try {
			return { ...(await currentVpnConfig()), configs: listVpnConfigs(), switching };
		} catch (error) {
			throw new AgentError(`Could not read the VPN configs: ${error.message}`, 500);
		}
	},
	startVpnSwitch: ({ suffix }) => {
		try {
			return { switching: startVpnSwitch(String(suffix ?? "")) };
		} catch (error) {
			throw new AgentError(error.message, error.message.startsWith("Unknown") ? 400 : 409);
		}
	},
	createProfile: async ({ name, tunnel }) => {
		try {
			const created = await createProfile(name, tunnel === "full" ? "full" : "lan");
			forgetVpn();
			return { created, vpn: await getVpn() };
		} catch (error) {
			throw new AgentError(error.message, 400);
		}
	},
	profileQr,
	profileConf,
	changePassword,
	upgradeYahoo,
	removeProfile: async ({ id }) => {
		try {
			const removed = await removeProfile(String(id ?? ""));
			forgetVpn();
			return { removed, vpn: await getVpn() };
		} catch (error) {
			throw new AgentError(error.message, 400);
		}
	},

	// Before the first backup there is no manifest, so the plan stands in, for the owner only
	backups: async ({ plan }) => {
		const status = getBackupStatus();
		if (plan === true && status.latestSources.length === 0) {
			try {
				status.latestSources = (await planBackup()).sources;
				status.sourcesArePlanned = true;
			} catch {}
		}
		const vaultMirror = await getVaultMirrorStatus().catch(() => null);
		return { ...status, drill: getDrillStatus(), vaultMirror };
	},
	startBackup: () => {
		try {
			startBackup("manual")
				.then(() => checkNow({ fresh: true }))
				.catch(() => checkNow({ fresh: true }));
		} catch (error) {
			throw new AgentError(error.message, 409);
		}
		return getBackupStatus();
	},
	backupDrives: async () => {
		try {
			return { drives: await listBackupDrives() };
		} catch (error) {
			throw new AgentError(error.message, 500);
		}
	},
	setBackupDrive: async ({ mount }) => {
		if (drillRunning()) {
			throw new AgentError("A restore drill is running, change the drive once it finishes", 409);
		}
		try {
			const drive = await setBackupDrive(String(mount ?? ""));
			console.log(`Backups now go to ${drive.dir}`);
			checkNow({ fresh: true }).catch(() => {});
			return { drive, status: { ...getBackupStatus(), drill: getDrillStatus() } };
		} catch (error) {
			throw new AgentError(error.message, 409);
		}
	},
	drill: () => getDrillStatus(),
	startDrill: () => {
		try {
			startDrill("manual")
				.then(() => checkNow({ fresh: true }))
				.catch(() => checkNow({ fresh: true }));
		} catch (error) {
			throw new AgentError(error.message, 409);
		}
		return getDrillStatus();
	},
	cancelDrill: () => {
		try {
			cancelDrill();
		} catch (error) {
			throw new AgentError(error.message, 409);
		}
		return getDrillStatus();
	},

	vaultMirror: async () => {
		try {
			return await getVaultMirrorStatus();
		} catch (error) {
			throw new AgentError(error.message, 503);
		}
	},
	// approve is the delete count shown to the owner, checksum compares every byte
	startVaultMirror: async ({ approve, checksum } = {}) => {
		try {
			const status = await startVaultMirror({ approve: Number(approve) || null, checksum: checksum === true });
			checkNow({ fresh: true }).catch(() => {});
			return status;
		} catch (error) {
			throw new AgentError(error.message, 409);
		}
	},
	cancelVaultMirror: async () => {
		try {
			return await cancelVaultMirror();
		} catch (error) {
			throw new AgentError(error.message, 409);
		}
	},

	// Plugs and energy come from the lights tool
	recovery: async () => {
		let plugs = [];
		let plugsError = null;
		try {
			plugs = await listPlugs();
		} catch (error) {
			plugsError = `Could not reach the lights tool: ${error.message}`;
		}
		return {
			settings: getRecoverySettings(),
			plugs,
			plugsError,
			status: getRecoveryStatus(),
			limits: RECOVERY_LIMITS,
		};
	},
	saveRecovery: ({ body }) => {
		const settings = parseRecoverySettings(body);
		if (typeof settings === "string") throw new AgentError(settings, 400);
		saveRecoverySettings(settings);
		return { settings, status: getRecoveryStatus() };
	},
	energy: async ({ range }) => {
		const safe = ["1d", "7d", "30d", "1y"].includes(range) ? range : "1d";
		try {
			return await lightsApi(`/energy?range=${safe}`);
		} catch (error) {
			throw new AgentError(`Could not reach the lights tool: ${error.message}`, 502);
		}
	},
	// Reading every plug takes a few seconds each
	energySync: async () => {
		try {
			return await lightsApi("/energy/sync", { method: "POST" }, 2 * 60 * 1000);
		} catch (error) {
			throw new AgentError(`Could not reach the lights tool: ${error.message}`, 502);
		}
	},

	// Only containers in the real list can be restarted, whatever the request says
	restartContainer: async ({ name }) => {
		try {
			const restarted = await restartContainer(String(name ?? ""));
			console.log(`Restarted containers from the dashboard: ${restarted.join(", ")}`);
			return { restarted };
		} catch (error) {
			throw new AgentError(error.message, error.message.startsWith("Unknown") ? 404 : 500);
		}
	},
	// Only apps in either pm2 list can be restarted, the website included
	restartService: async ({ name }) => {
		try {
			const restarted = await restartService(String(name ?? ""));
			console.log(`Restarted pm2 service from the dashboard: ${restarted}`);
			return { restarted: [restarted] };
		} catch (error) {
			throw new AgentError(error.message, error.message.startsWith("Unknown") ? 404 : 500);
		}
	},
	restartCloudflared: () => {
		console.log("cloudflared restart requested from /server");
		try {
			restartCloudflared();
		} catch (error) {
			console.log(`cloudflared restart failed: ${error?.message}`);
			throw new AgentError("Could not restart cloudflared", 500);
		}
		return { ok: true };
	},
	reboot: () => {
		console.log("Server reboot requested from /server");
		helper(["reboot"]).catch((error) => console.log(`Reboot failed: ${error?.message}`));
		return { ok: true };
	},
	// The old stack's script that restarts Docker with IPv6
	dockerIpv6: () => {
		try {
			helperSync(["docker-ipv6"]);
		} catch (error) {
			console.error("Error restarting Docker:", error);
			throw new AgentError("Error restarting Docker", 500);
		}
		return { ok: true };
	},
	theme: async ({ action }) => {
		try {
			return await themeStatus(["on", "off"].includes(action) ? action : "status");
		} catch (error) {
			console.error("Error switching the theme:", error);
			throw new AgentError("Could not switch the theme", 500);
		}
	},
};

async function answer(line) {
	let request;
	try {
		request = JSON.parse(line);
	} catch {
		return { error: { message: "Unreadable request", status: 400 } };
	}
	const method = typeof request?.method === "string" ? request.method : "";
	if (!Object.hasOwn(METHODS, method)) {
		return { error: { message: "Unknown agent method", status: 400 } };
	}
	const args = request.args && typeof request.args === "object" && !Array.isArray(request.args) ? request.args : {};
	try {
		return { result: (await METHODS[method](args)) ?? null };
	} catch (error) {
		if (!(error instanceof AgentError)) console.error(`Agent ${method} failed:`, error);
		return { error: { message: error?.message ?? "Agent error", status: error?.status ?? 500 } };
	}
}

export function startAgentServer() {
	// Left behind by a previous run, listen fails while it exists
	fs.rmSync(AGENT_SOCKET, { force: true });

	const server = net.createServer((socket) => {
		let buffer = "";
		socket.setEncoding("utf-8");
		socket.on("error", () => {});
		socket.on("data", async (chunk) => {
			buffer += chunk;
			if (buffer.length > MAX_REQUEST) {
				socket.destroy();
				return;
			}
			const end = buffer.indexOf("\n");
			if (end === -1) return;
			const line = buffer.slice(0, end);
			buffer = "";
			socket.end(`${JSON.stringify(await answer(line))}\n`);
		});
	});

	// The folder limits who can connect, the socket itself has to be writable for apps
	server.listen(AGENT_SOCKET, () => {
		fs.chmodSync(AGENT_SOCKET, 0o666);
		console.log(`Agent listening on ${AGENT_SOCKET}`);
	});
	return server;
}
