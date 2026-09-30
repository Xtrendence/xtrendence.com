import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sendBotNotification } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Remembers what was last sent, so a website restart does not repeat it
const stateFile = path.join(__dirname, "../data/alert-notified.json");

// FCM caps a data message at 4KB, and the bot base64 encodes and then
// encrypts the text, so roughly a third of that is left for the body
const MAX_BODY = 1200;
const MAX_MESSAGE = 180;

const SHORT_NAMES = {
	services: "pm2 services",
	crashLoop: "Crash loops",
	certificate: "SSL",
	website: "Website",
	backup: "Backups",
	internet: "Internet",
	driveForecast: "Drive growth",
	vpn: "VPN",
	vpnDns: "VPN address",
	mainDriveWarn: "Main drive",
	mainDriveFull: "Main drive",
	driveMissing: "Drives mounted",
	otherDrives: "Other drives",
	swap: "Swap",
	cpu: "CPU",
	memory: "Memory",
	temperature: "Temperature",
	driveFailing: "SMART",
	driveWearing: "Drive wear",
	containers: "Containers",
	containerHealth: "Container health",
	inodes: "Inodes",
	kernel: "Kernel",
};

const TITLES = {
	hard: "Server critical",
	soft: "Server warning",
	ok: "Server all clear",
};

function readState() {
	try {
		const saved = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
		return Array.isArray(saved?.ids) ? saved : { ids: [] };
	} catch {
		return { ids: [] };
	}
}

function writeState(state) {
	try {
		fs.mkdirSync(path.dirname(stateFile), { recursive: true });
		fs.writeFileSync(stateFile, JSON.stringify(state, null, 4));
	} catch (error) {
		console.log(`Could not save alert notification state: ${error?.message}`);
	}
}

function clip(text, length) {
	return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function unique(names) {
	return [...new Set(names)];
}

export function buildBody(status, rules, previousIds) {
	const failingIds = new Set(status.issues.map((issue) => issue.id));
	const active = rules.filter((rule) => rule.level !== "off");

	const issueLine = (issue) => {
		const fresh = previousIds.includes(issue.id) ? "" : " (new)";
		return `• ${issue.label}${fresh}: ${clip(issue.message, MAX_MESSAGE)}`;
	};

	const sections = [];

	const hard = status.issues.filter((issue) => issue.level === "hard");
	const soft = status.issues.filter((issue) => issue.level === "soft");

	if (hard.length) {
		sections.push(["🔴 Critical", ...hard.map(issueLine)].join("\n"));
	}
	if (soft.length) {
		sections.push(["🟣 Warning", ...soft.map(issueLine)].join("\n"));
	}

	const cleared = previousIds.filter((id) => !failingIds.has(id));
	if (cleared.length) {
		const names = unique(cleared.map((id) => SHORT_NAMES[id] ?? id));
		sections.push(`✔️ Recovered: ${names.join(", ")}`);
	}

	// A check whose twin is failing, like the two main drive rules, is not
	// listed as passing
	const failingNames = new Set([...failingIds].map((id) => SHORT_NAMES[id] ?? id));
	const passing = unique(
		active
			.filter((rule) => !failingIds.has(rule.id))
			.map((rule) => SHORT_NAMES[rule.id] ?? rule.id)
			.filter((name) => !failingNames.has(name)),
	);
	if (passing.length) {
		sections.push(`✅ Passing (${passing.length}): ${passing.join(", ")}`);
	}

	const off = unique(
		rules.filter((rule) => rule.level === "off").map((rule) => SHORT_NAMES[rule.id] ?? rule.id),
	);
	if (off.length) {
		sections.push(`⚪ Not checked: ${off.join(", ")}`);
	}

	if (status.delivered && !status.delivered.ok) {
		sections.push(`💡 Light not updated: ${status.delivered.error}`);
	}

	let body = sections.join("\n\n");

	// Failures matter most, so the passing and unchecked lists go first
	if (body.length > MAX_BODY) {
		body = sections
			.filter((section) => !/^(✅|⚪)/u.test(section))
			.concat(passing.length ? [`✅ ${passing.length} other checks passing`] : [])
			.join("\n\n");
	}

	return clip(body, MAX_BODY);
}

// Sends only when the set of failing checks changes. Numbers inside a message,
// like the current CPU usage, move every check and would spam otherwise
export async function notifyIfChanged(status, rules) {
	const previous = readState();
	const ids = [...new Set(status.issues.map((issue) => issue.id))].sort();

	if (JSON.stringify(ids) === JSON.stringify(previous.ids)) {
		return null;
	}

	const title = TITLES[status.level] ?? "Server health";
	const body = buildBody(status, rules, previous.ids);
	const sent = await sendBotNotification({ title, body });

	// Left unrecorded on failure so the next check tries again
	if (sent) {
		writeState({ ids, sentAt: new Date().toISOString(), level: status.level });
	}

	return { sent, title, body };
}

// The manual button on /server. Always sends, and marks nothing as new or
// recovered since it is a snapshot rather than a change
export async function sendStatusNotification(status, rules) {
	const ids = status.issues.map((issue) => issue.id);
	const title = TITLES[status.level] ?? "Server health";
	const body = buildBody(status, rules, ids);
	const sent = await sendBotNotification({ title, body });
	return { sent, title, body };
}
