import net from "node:net";
import { closeOutage, currentOutage, openOutage } from "./history.js";
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
const ROUTER = { host: "192.168.1.1", port: 80 };

let failures = 0;
let firstFailure = null;
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

async function probe() {
	const results = await Promise.all(TARGETS.map(reachable));
	const online = results.some(Boolean);
	const now = Date.now();

	if (online) {
		failures = 0;
		firstFailure = null;

		const outage = closeOutage(now);
		if (outage) {
			const duration = formatDuration(outage.ended - outage.started);
			console.log(`Internet back after ${duration}`);
			// Sent now rather than during the outage, when it could not get out
			if (notify) {
				sendBotNotification({
					title: "Internet outage",
					body: `The internet was down from ${formatTime(outage.started)} to ${formatTime(outage.ended)} (${duration}). ${outage.reason}.`,
				});
			}
		}
		return;
	}

	failures += 1;
	firstFailure ??= now;

	if (failures === FAILURES_TO_OPEN && !currentOutage()) {
		// Tells a dead router apart from the ISP dropping the line
		const routerUp = await reachable(ROUTER);
		const reason = routerUp ? "The router was up, so the ISP connection dropped" : "The router was not answering either";
		openOutage(firstFailure, reason);
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
