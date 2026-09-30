import axios from "axios";
import { Resolver } from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import { notifyIfChanged, sendStatusNotification } from "./alertNotifications.js";
import { getBackupHealth } from "./backups.js";
import { localConfig } from "./localConfig.js";
import { isOffline } from "./connectivity.js";
import { driveForecasts, recordAlertState } from "./history.js";
import { getCrashLoops, getUnhealthyContainers, startTrackers } from "./alertTrackers.js";
import {
	collectServerStats,
	diffCpu,
	getInodes,
	listMounts,
	readCpuSample,
} from "./serverStats.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rulesFile = path.join(__dirname, "../data/alert-rules.json");

const CHECK_INTERVAL = 5 * 60 * 1000;
const CPU_SAMPLE_INTERVAL = 15 * 1000;
const CPU_WINDOW = 5 * 60 * 1000;
const WEBSITE_URL = "https://xtrendence.com";
const CERTIFICATE_HOSTS = ["xtrendence.com", "www.xtrendence.com"];
const VPN_HOST = "direct.xtrendence.com";

// The dns-updater runs every 5 minutes, so a new public IP can sit in DNS
// unchanged for that long. A minute on top keeps the two from racing
const VPN_DNS_GRACE = 6 * 60 * 1000;
// Checks drift by a few seconds, which would otherwise push a mismatch seen
// exactly 5 minutes apart to the check after
const VPN_DNS_TOLERANCE = 15 * 1000;
const LIGHTS_ALERT_URL = "http://localhost:3001/api/alerts";

export const LEVELS = ["off", "soft", "hard"];

const PERCENT = { unit: "%", min: 1, max: 100 };

// Some rules carry a list of names picked on the page. The source says where
// the choices come from and the pattern is what a saved name must look like
const LISTS = {
	containers: {
		label: "Ignore",
		source: "containers",
		// Docker's own rule for container names
		pattern: /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/,
	},
	mounts: {
		label: "Watch",
		source: "mounts",
		pattern: /^\/[\w .\/-]{0,255}$/,
	},
};

// The catalogue the /server page edits. Each entry only needs its default
// level and, when it compares against a number, a default threshold
export const RULES = [
	{
		id: "services",
		label: "A pm2 service is down",
		hint: "Any process pm2 does not report as online",
		level: "hard",
	},
	{
		id: "crashLoop",
		label: "A pm2 service is crash looping",
		hint: "Over 10 restarts in 5 minutes at a steady interval",
		level: "hard",
	},
	{
		id: "certificate",
		label: "SSL certificate expired",
		hint: "The public certificate for xtrendence.com and www",
		level: "hard",
	},
	{
		id: "website",
		label: "xtrendence.com unreachable",
		hint: "No answer, an error status, or a Cloudflare error page",
		level: "hard",
	},
	{
		id: "internet",
		label: "Internet is down",
		hint: "None of Cloudflare, Google or Quad9 answered for a minute",
		level: "hard",
	},
	{
		id: "backup",
		label: "Backup failed or missed",
		hint: "The nightly backup did not happen, failed, or a backup file is damaged",
		level: "hard",
	},
	{
		id: "vpn",
		label: "VPN is down",
		hint: "The WireGuard container is stopped or not listening",
		level: "hard",
	},
	{
		id: "vpnDns",
		label: "VPN address out of date",
		hint: "direct.xtrendence.com has not matched the public IP for 6 minutes",
		level: "soft",
	},
	{
		id: "mainDriveWarn",
		label: "Main drive filling up",
		hint: "Usage of the / mount",
		level: "soft",
		threshold: 75,
		...PERCENT,
	},
	{
		id: "mainDriveFull",
		label: "Main drive nearly full",
		hint: "Usage of the / mount",
		level: "hard",
		threshold: 90,
		...PERCENT,
	},
	{
		id: "driveMissing",
		label: "A drive has gone missing",
		hint: "A watched mount is gone or its device has disappeared",
		level: "hard",
		list: LISTS.mounts,
		names: localConfig().alerts.watchMounts,
	},
	{
		id: "driveForecast",
		label: "A drive is filling fast",
		hint: "At the growth of the last two weeks, full within this many days",
		level: "soft",
		threshold: 30,
		unit: "days",
		min: 1,
		max: 365,
	},
	{
		id: "otherDrives",
		label: "Another drive nearly full",
		hint: "Any mounted drive other than /",
		level: "soft",
		threshold: 90,
		...PERCENT,
	},
	{
		id: "swap",
		label: "Swap in use",
		hint: "More than this much swapped out, small amounts are normal",
		level: "hard",
		threshold: 10,
		unit: "MB",
		min: 0,
		max: 100000,
	},
	{
		id: "cpu",
		label: "CPU pinned",
		hint: "Above the threshold for the whole of the last 5 minutes",
		level: "hard",
		threshold: 80,
		...PERCENT,
	},
	{
		id: "memory",
		label: "Memory pressure",
		hint: "RAM in use, not counting cache",
		level: "soft",
		threshold: 90,
		...PERCENT,
	},
	{
		id: "temperature",
		label: "Running hot",
		hint: "The hottest thermal sensor",
		level: "soft",
		threshold: 80,
		unit: "°C",
		min: 30,
		max: 120,
	},
	{
		id: "driveFailing",
		label: "A drive is failing",
		hint: "SMART failure, reallocated, pending or bad sectors",
		level: "hard",
	},
	{
		id: "driveWearing",
		label: "A drive is wearing out",
		hint: "CRC errors, low spare capacity or high endurance use",
		level: "soft",
	},
	{
		id: "containers",
		label: "A Docker container is stopped",
		hint: "Any container that is not running, apart from those ignored",
		level: "soft",
		list: LISTS.containers,
		names: localConfig().alerts.ignoreContainers,
	},
	{
		id: "containerHealth",
		label: "A Docker container is unhealthy",
		hint: "Unhealthy or stuck restarting for over 5 minutes",
		level: "soft",
		list: LISTS.containers,
		names: [],
	},
	{
		id: "inodes",
		label: "Inodes running out",
		hint: "Any drive, no new files can be made once these are gone",
		level: "soft",
		threshold: 90,
		...PERCENT,
	},
	{
		id: "kernel",
		label: "Kernel errors this boot",
		hint: "I/O, filesystem, OOM or thermal events, cleared by a reboot",
		level: "off",
	},
];

const cpuHistory = [];
let lastCpuSample = null;

let status = {
	level: "ok",
	issues: [],
	checkedAt: null,
	delivered: null,
};

let checking = null;
let vpnDnsMismatchSince = null;
let notify = true;

function sampleCpu() {
	const current = readCpuSample();
	if (lastCpuSample) {
		const usage = diffCpu(lastCpuSample, current).cpu ?? 0;
		cpuHistory.push({ time: Date.now(), usage });
	}
	lastCpuSample = current;

	const cutoff = Date.now() - CPU_WINDOW * 2;
	while (cpuHistory.length && cpuHistory[0].time < cutoff) {
		cpuHistory.shift();
	}
}

// Only true once there is a full window of history and none of it dipped
function cpuSustainedAbove(threshold) {
	const since = Date.now() - CPU_WINDOW;
	const oldest = cpuHistory[0];
	if (!oldest || oldest.time > since + CPU_SAMPLE_INTERVAL) {
		return false;
	}
	const window = cpuHistory.filter((sample) => sample.time >= since);
	return window.length > 0 && window.every((sample) => sample.usage > threshold);
}

function formatBytes(bytes) {
	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = Number(bytes) || 0;
	let index = 0;
	while (value >= 1024 && index < units.length - 1) {
		value /= 1024;
		index += 1;
	}
	return `${value.toFixed(index < 2 ? 0 : 1)} ${units[index]}`;
}

export function getRules() {
	let saved = {};
	try {
		saved = JSON.parse(fs.readFileSync(rulesFile, "utf-8"));
	} catch {}

	return RULES.map((rule) => {
		const override = saved?.[rule.id] ?? {};
		return {
			...rule,
			list: rule.list && { label: rule.list.label, source: rule.list.source },
			level: LEVELS.includes(override.level) ? override.level : rule.level,
			threshold:
				rule.threshold === undefined
					? undefined
					: Number.isFinite(override.threshold)
						? override.threshold
						: rule.threshold,
			names:
				rule.list === undefined
					? undefined
					: Array.isArray(override.names)
						? override.names.filter((name) => rule.list.pattern.test(name))
						: rule.names,
		};
	});
}

export function saveRules(input) {
	if (!input || typeof input !== "object") {
		throw new Error("Expected an object of rules");
	}

	const output = {};

	for (const rule of RULES) {
		const entry = input[rule.id];
		if (!entry) continue;

		if (!LEVELS.includes(entry.level)) {
			throw new Error(`${rule.label} has an unknown level`);
		}

		output[rule.id] = { level: entry.level };

		if (rule.threshold !== undefined) {
			const threshold = Number(entry.threshold);
			if (!Number.isFinite(threshold) || threshold < rule.min || threshold > rule.max) {
				throw new Error(`${rule.label} needs a threshold between ${rule.min} and ${rule.max}`);
			}
			output[rule.id].threshold = threshold;
		}

		if (rule.list !== undefined) {
			const names = entry.names ?? [];
			if (!Array.isArray(names) || !names.every((name) => rule.list.pattern.test(name))) {
				throw new Error(`${rule.label} has an invalid name in its list`);
			}
			output[rule.id].names = [...new Set(names)].sort();
		}
	}

	fs.mkdirSync(path.dirname(rulesFile), { recursive: true });
	fs.writeFileSync(rulesFile, JSON.stringify(output, null, 4));
}

async function checkWebsite() {
	try {
		const response = await axios.get(WEBSITE_URL, {
			timeout: 15000,
			validateStatus: () => true,
			responseType: "text",
			headers: { "User-Agent": "xtrendence-health-monitor" },
		});

		const body = String(response.data ?? "");
		const cloudflare = /cf-error-details|cf-error-code|cf-wrapper/i.test(body);
		const code = body.match(/Error code (\d{3,4})/i)?.[1];

		if (cloudflare) {
			return `Cloudflare error${code ? ` ${code}` : ""} (HTTP ${response.status})`;
		}
		if (response.status >= 400) {
			return `HTTP ${response.status}`;
		}
		return null;
	} catch (error) {
		return error?.code ?? error?.message ?? "No response";
	}
}

function minutesSince(time) {
	return Math.floor((Date.now() - time) / 60000);
}

// Traffic reaches the site through a Cloudflare tunnel, so the certificate
// visitors get is Cloudflare's edge one. Read without verifying so an expired
// one still reports its date
function publicCertificate(host) {
	return new Promise((resolve) => {
		const socket = tls.connect({
			host,
			port: 443,
			servername: host,
			rejectUnauthorized: false,
			timeout: 10000,
		});

		const done = (value) => {
			socket.destroy();
			resolve(value);
		};

		socket.once("secureConnect", () => {
			const validTo = socket.getPeerCertificate()?.valid_to;
			done(validTo ? { host, validTo: new Date(validTo) } : null);
		});
		socket.once("timeout", () => done(null));
		socket.once("error", () => done(null));
	});
}

// Unreachable hosts are left to the website rule rather than reported here
async function checkCertificate() {
	const certificates = await Promise.all(CERTIFICATE_HOSTS.map(publicCertificate));
	return certificates.filter((cert) => cert && cert.validTo.getTime() < Date.now());
}

// Asks Cloudflare's resolver directly so a stale local cache cannot hide a
// record the dns-updater failed to update
async function checkVpnDns() {
	try {
		const resolver = new Resolver({ timeout: 5000, tries: 2 });
		resolver.setServers(["1.1.1.1", "1.0.0.1"]);
		const [records, { data: publicIp }] = await Promise.all([
			resolver.resolve4(VPN_HOST).catch(() => []),
			axios.get("https://api.ipify.org", { timeout: 10000, responseType: "text" }),
		]);
		const ip = String(publicIp).trim();
		if (!records.length) return `${VPN_HOST} has no A record`;
		if (!records.includes(ip)) return `${VPN_HOST} points at ${records.join(", ")} but the public IP is ${ip}`;
		return null;
	} catch (error) {
		// No answer from ipify says nothing about the record, so it is not flagged
		return null;
	}
}

function evaluate(rule, stats, website, extra) {
	const drives = stats.drives ?? [];
	const main = drives.find((drive) => drive.mount === "/");

	switch (rule.id) {
		case "services": {
			const down = (stats.services ?? []).filter((service) => service.status !== "online");
			return down.length
				? `pm2: ${down.map((service) => `${service.name} is ${service.status}`).join(", ")}`
				: null;
		}
		case "website":
			return website ? `xtrendence.com: ${website}` : null;
		case "mainDriveWarn":
		case "mainDriveFull":
			return main && main.percent >= rule.threshold
				? `Main drive at ${main.percent}%, ${formatBytes(main.avail)} free`
				: null;
		case "otherDrives": {
			const full = drives.filter(
				(drive) => drive.mount !== "/" && drive.percent >= rule.threshold,
			);
			return full.length
				? `${full.map((drive) => `${drive.mount} at ${drive.percent}%`).join(", ")}`
				: null;
		}
		case "swap":
			return stats.memory?.swap?.used > rule.threshold * 1024 * 1024
				? `Swap in use: ${formatBytes(stats.memory.swap.used)}`
				: null;
		case "cpu":
			return cpuSustainedAbove(rule.threshold)
				? `CPU above ${rule.threshold}% for 5 minutes, now ${stats.cpu.usage.toFixed(0)}%`
				: null;
		case "memory":
			return stats.memory?.percent >= rule.threshold
				? `Memory at ${stats.memory.percent.toFixed(0)}%`
				: null;
		case "temperature": {
			const hottest = stats.temperatures?.[0];
			return hottest && hottest.value >= rule.threshold
				? `${hottest.label} at ${hottest.value.toFixed(0)}°C`
				: null;
		}
		case "driveFailing": {
			const failing = drives.filter((drive) => drive.health?.status === "critical");
			return failing.length
				? failing.map((drive) => `${drive.mount}: ${drive.health.reasons.join(", ")}`).join(" / ")
				: null;
		}
		case "driveWearing": {
			const wearing = drives.filter((drive) => drive.health?.status === "warning");
			return wearing.length
				? wearing.map((drive) => `${drive.mount}: ${drive.health.reasons.join(", ")}`).join(" / ")
				: null;
		}
		case "containers": {
			const stopped = (stats.containers ?? []).filter(
				(container) => container.state !== "running" && !rule.names.includes(container.name),
			);
			return stopped.length
				? `Stopped: ${stopped.map((container) => container.name).join(", ")}`
				: null;
		}
		case "containerHealth": {
			const unhealthy = getUnhealthyContainers().filter(
				(container) => !rule.names.includes(container.name),
			);
			return unhealthy.length
				? unhealthy
						.map((container) => `${container.name} ${container.reason} for ${minutesSince(container.since)} min`)
						.join(", ")
				: null;
		}
		case "crashLoop": {
			// The log still holds restarts of apps that have since been deleted
			const known = new Set((stats.services ?? []).map((service) => service.name));
			const loops = getCrashLoops().filter((loop) => known.has(loop.name));
			return loops.length
				? loops
						.map((loop) => `${loop.name} restarting every ${Math.round(loop.interval / 1000)}s`)
						.join(", ")
				: null;
		}
		case "internet":
			return isOffline() ? "No connection to the internet" : null;
		case "driveForecast": {
			const filling = driveForecasts().filter(
				(forecast) => forecast.daysToFull !== null && forecast.daysToFull <= rule.threshold,
			);
			return filling.length
				? filling
						.map((forecast) => `${forecast.mount} full in about ${Math.max(1, Math.round(forecast.daysToFull))} days`)
						.join(", ")
				: null;
		}
		case "backup": {
			const health = getBackupHealth();
			return health.ok ? null : health.reason;
		}
		case "vpn": {
			const vpn = stats.vpn;
			if (!vpn?.installed) return "The VPN container does not exist";
			if (!vpn.up) return `WireGuard is ${vpn.state === "running" ? "not listening" : vpn.state}`;
			return null;
		}
		case "vpnDns":
			return extra.vpnDns ?? null;
		case "certificate":
			return extra.certificate?.length
				? extra.certificate
						.map((cert) => `${cert.host} expired ${cert.validTo.toLocaleString("en-GB")}`)
						.join(", ")
				: null;
		case "driveMissing": {
			const missing = rule.names
				.map((mount) => {
					const found = extra.mounts?.find((entry) => entry.mount === mount);
					if (!found) return `${mount} is not mounted`;
					if (!fs.existsSync(found.device)) return `${mount} lost ${found.device}`;
					return null;
				})
				.filter(Boolean);
			return missing.length ? missing.join(", ") : null;
		}
		case "inodes": {
			const low = (extra.inodes ?? []).filter((entry) => entry.percent >= rule.threshold);
			return low.length
				? low.map((entry) => `${entry.mount} at ${entry.percent}% of inodes`).join(", ")
				: null;
		}
		case "kernel": {
			const keys = ["ioErrors", "filesystemErrors", "oomKills", "thermalEvents"];
			const found = keys
				.map((key) => stats.events?.[key])
				.filter((event) => event?.count > 0);
			return found.length
				? found.map((event) => `${event.count} ${event.label.toLowerCase()}`).join(", ")
				: null;
		}
		default:
			return null;
	}
}

async function notifyLights(level) {
	const key = process.env.LIGHTS_KEY;
	if (!key) {
		return "LIGHTS_KEY is not set";
	}

	try {
		await axios.post(LIGHTS_ALERT_URL, { level }, { headers: { key }, timeout: 20000 });
		return null;
	} catch (error) {
		return error?.response?.data?.error ?? error?.message ?? "Lights tool unreachable";
	}
}

async function runCheck() {
	const allRules = getRules();
	const rules = allRules.filter((rule) => rule.level !== "off");

	const enabled = (id) => rules.some((rule) => rule.id === id);

	const [stats, website, certificate, mounts, inodes, vpnDns] = await Promise.all([
		collectServerStats(),
		enabled("website") ? checkWebsite() : null,
		enabled("certificate") ? checkCertificate() : null,
		enabled("driveMissing") ? listMounts() : null,
		enabled("inodes") ? getInodes() : null,
		enabled("vpnDns") ? checkVpnDns() : null,
	]);

	// Only a mismatch that has outlasted the grace period is reported. Any
	// check that finds the record correct, or cannot tell, starts it over
	let vpnDnsIssue = null;
	if (vpnDns) {
		vpnDnsMismatchSince ??= Date.now();
		const lasted = Date.now() - vpnDnsMismatchSince;
		if (lasted >= VPN_DNS_GRACE - VPN_DNS_TOLERANCE) {
			vpnDnsIssue = `${vpnDns}, for ${Math.round(lasted / 60000)} min`;
		}
	} else {
		vpnDnsMismatchSince = null;
	}

	const extra = { certificate, mounts, inodes, vpnDns: vpnDnsIssue };

	const issues = [];
	for (const rule of rules) {
		const message = evaluate(rule, stats, website, extra);
		if (message) {
			issues.push({ id: rule.id, level: rule.level, label: rule.label, message });
		}
	}

	const level = issues.some((issue) => issue.level === "hard")
		? "hard"
		: issues.length
			? "soft"
			: "ok";

	const deliveryError = notify ? await notifyLights(level) : "Dev mode, light not updated";
	if (notify && deliveryError && deliveryError !== status.delivered?.error) {
		console.log(`Could not update the alert light: ${deliveryError}`);
	}

	status = {
		level,
		issues,
		checkedAt: new Date().toISOString(),
		delivered: { ok: !deliveryError, error: deliveryError },
	};

	// Same rule as the light, only the production instance reaches the phone
	// and writes the alert timeline
	if (notify) {
		try {
			recordAlertState(issues);
		} catch (error) {
			console.log(`Could not record alert history: ${error?.message}`);
		}

		const result = await notifyIfChanged(status, allRules).catch((error) => {
			console.log(`Health notification failed: ${error?.message}`);
			return null;
		});
		if (result && !result.sent) {
			console.log("Health notification was not delivered, retrying next check");
		}
	}

	return status;
}

// Overlapping callers share one run. A fresh check waits out any run that
// started before the rules changed and then does its own
export async function checkNow({ fresh = false } = {}) {
	if (fresh && checking) {
		await checking;
	}
	if (!checking) {
		checking = runCheck()
			.catch((error) => {
				console.error("Health check failed:", error);
				return status;
			})
			.finally(() => {
				checking = null;
			});
	}
	return checking;
}

// Runs a check first when none has happened yet, so the snapshot is real
export async function sendNotificationNow() {
	const current = status.checkedAt ? status : await checkNow({ fresh: true });
	return sendStatusNotification(current, getRules());
}

export function getAlertStatus() {
	return status;
}

export function startHealthMonitor({ notifyLights: shouldNotify = true } = {}) {
	notify = shouldNotify;
	sampleCpu();
	setInterval(sampleCpu, CPU_SAMPLE_INTERVAL);
	startTrackers();

	// Short delay so the first check does not race the rest of startup
	setTimeout(checkNow, 20 * 1000);
	setInterval(checkNow, CHECK_INTERVAL);
}
