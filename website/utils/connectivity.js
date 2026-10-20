import net from "node:net";
import { closeOutage, currentOutage, openOutage } from "./history.js";
import { gatewayAnswers, getRecoverySettings } from "./internetRecovery.js";
import { sendBotNotification } from "./utils.js";

const PROBE_INTERVAL = 30 * 1000;
const PROBE_TIMEOUT = 4000;
// Two failed rounds in a row, about a minute, before it counts as an outage
const FAILURES_TO_OPEN = 2;

// Three unrelated networks, so one provider having a bad day is not an outage
const TARGETS = [
	{ host: "1.1.1.1", port: 443 },
	{ host: "8.8.8.8", port: 443 },
	{ host: "9.9.9.9", port: 443 },
];
let failures = 0;
let firstFailure = null;
let routerFailures = 0;
let routerFirstFailure = null;
let notify = true;

function reachable({ host, port }) {
	return new Promise((resolve) => {
		const socket = net.connect({ host, port, timeout: PROBE_TIMEOUT });
		const done = (ok) => {
			socket.destroy();
			resolve(ok);
		};
		socket.once("connect", () => done(true));
		socket.once("timeout", () => done(false));
		socket.once("error", () => done(false));
	});
}

function formatTime(time) {
	return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms) {
	const minutes = Math.max(1, Math.round(ms / 60000));
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	return `${hours} h ${minutes % 60} min`;
}

function notifyEnded(title, body) {
	if (notify) sendBotNotification({ title, body });
}

// The internet only counts as down while the router answers, a router that is off or rebooting is logged as its own event
async function probe() {
	const host = getRecoverySettings().gatewayHost;
	const [results, routerUp] = await Promise.all([Promise.all(TARGETS.map(reachable)), gatewayAnswers(host)]);
	const online = results.some(Boolean);
	const now = Date.now();

	// Online means the router works, so a silent gateway address is just one that ignores these ports
	if (online || routerUp) {
		routerFailures = 0;
		routerFirstFailure = null;
		const event = closeOutage(now, "router");
		if (event) {
			const duration = formatDuration(event.ended - event.started);
			console.log(`Router back after ${duration}`);
			notifyEnded("Router down", `The router at ${host} was not answering from ${formatTime(event.started)} to ${formatTime(event.ended)} (${duration}).`);
		}
	} else {
		routerFailures += 1;
		routerFirstFailure ??= now;
		if (routerFailures >= FAILURES_TO_OPEN && !currentOutage("router")) {
			openOutage(routerFirstFailure, `The router at ${host} was not answering`, "router");
			console.log(`Router down since ${formatTime(routerFirstFailure)}`);
		}
	}

	if (online) {
		failures = 0;
		firstFailure = null;

		const outage = closeOutage(now);
		if (outage) {
			const duration = formatDuration(outage.ended - outage.started);
			console.log(`Internet back after ${duration}`);
			// Sent now rather than during the outage, when it could not get out
			notifyEnded(
				"Internet outage",
				`The internet was down from ${formatTime(outage.started)} to ${formatTime(outage.ended)} (${duration}). ${outage.reason}.`,
			);
		}
		return;
	}

	// Nothing can be said about the internet behind a router that is not answering
	if (!routerUp) {
		if (!currentOutage()) {
			failures = 0;
			firstFailure = null;
		}
		return;
	}

	failures += 1;
	firstFailure ??= now;

	if (failures >= FAILURES_TO_OPEN && !currentOutage()) {
		openOutage(firstFailure, "The router was up but nothing past it answered, so the modem or the ISP connection dropped");
		console.log(`Internet outage started at ${formatTime(firstFailure)}`);
	}
}

export function isOffline() {
	return Boolean(currentOutage());
}

export function startConnectivityMonitor({ notifyPhone = true } = {}) {
	notify = notifyPhone;

	const tick = () =>
		probe().catch((error) => {
			console.log(`Connectivity probe failed: ${error?.message}`);
		});

	tick();
	setInterval(tick, PROBE_INTERVAL);
}
