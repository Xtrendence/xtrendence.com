import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { currentOutage, noteOutage } from "./history.js";

// Power cycles the modem, then the router, through the lights tool's smart plugs when an outage drags on

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETTINGS_FILE = path.join(__dirname, "../data/internet-recovery.json");
const LIGHTS_API = "http://localhost:3001/api";
const TICK = 15 * 1000;
// A plug restart waits up to five minutes for the device behind it, so the request gets longer
const CYCLE_TIMEOUT = 10 * 60 * 1000;

const DEFAULTS = {
	gatewayHost: "192.168.1.1",
	modemPlugId: null,
	routerPlugId: null,
	modemEnabled: false,
	routerEnabled: false,
	downMinutes: 5,
	gapMinutes: 3,
};

export const LIMITS = { downMinutes: [1, 120], gapMinutes: [0, 60] };

const hostPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i;
// Any of these answering, or refusing the connection, proves the router is alive
const GATEWAY_PORTS = [80, 443, 53, 22];

let state = { outageStarted: null, modem: null, router: null };
let running = null;
let gateway = { host: null, up: null, checkedAt: null };

function knocks(host, port) {
	return new Promise((resolve) => {
		const socket = net.connect({ host, port, timeout: 4000 });
		const done = (alive) => {
			socket.destroy();
			resolve(alive);
		};
		socket.once("connect", () => done(true));
		socket.once("timeout", () => done(false));
		socket.once("error", (error) => done(error?.code === "ECONNREFUSED"));
	});
}

export async function gatewayAnswers(host = getRecoverySettings().gatewayHost) {
	const up = (await Promise.all(GATEWAY_PORTS.map((port) => knocks(host, port)))).some(Boolean);
	gateway = { host, up, checkedAt: Date.now() };
	return up;
}

export function getRecoverySettings() {
	try {
		return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) };
	} catch {
		return { ...DEFAULTS };
	}
}

const plugId = (value) => (value === null || value === "" || value === undefined ? null : Number(value));

export function parseRecoverySettings(raw) {
	const settings = {
		gatewayHost: String(raw?.gatewayHost ?? "").trim(),
		modemPlugId: plugId(raw?.modemPlugId),
		routerPlugId: plugId(raw?.routerPlugId),
		modemEnabled: raw?.modemEnabled === true,
		routerEnabled: raw?.routerEnabled === true,
		downMinutes: Number(raw?.downMinutes),
		gapMinutes: Number(raw?.gapMinutes),
	};
	if (!settings.gatewayHost || settings.gatewayHost.length > 253 || !hostPattern.test(settings.gatewayHost)) {
		return "The router address needs to be an IP like 192.168.1.1 or a hostname";
	}
	for (const key of ["modemPlugId", "routerPlugId"]) {
		if (settings[key] !== null && !(Number.isInteger(settings[key]) && settings[key] > 0)) return "Pick a plug from the list";
	}
	if (settings.modemPlugId !== null && settings.modemPlugId === settings.routerPlugId) {
		return "The modem and router need different plugs";
	}
	for (const [key, [min, max]] of Object.entries(LIMITS)) {
		if (!Number.isFinite(settings[key]) || settings[key] < min || settings[key] > max) {
			return `${key === "downMinutes" ? "The wait before restarting" : "The gap between restarts"} must be ${min} to ${max} minutes`;
		}
	}
	if (settings.modemEnabled && settings.modemPlugId === null) return "Pick the modem's plug, or turn modem reboots off";
	if (settings.routerEnabled && settings.routerPlugId === null) return "Pick the router's plug, or turn router reboots off";
	return settings;
}

export function saveRecoverySettings(settings) {
	fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
	fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 4));
}

export async function lights(route, options = {}, timeout = 15000) {
	const key = process.env.LIGHTS_KEY;
	if (!key) throw new Error("LIGHTS_KEY is not set");
	const response = await fetch(`${LIGHTS_API}${route}`, {
		...options,
		headers: { "Content-Type": "application/json", key, ...(options.headers ?? {}) },
		signal: AbortSignal.timeout(timeout),
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data?.error ?? `The lights tool answered ${response.status}`);
	return data;
}

export async function listPlugs() {
	return (await lights("/plugs")).map((plug) => ({
		id: plug.id,
		name: plug.name,
		ip: plug.ip,
		online: plug.status?.online ?? null,
		busy: plug.status?.busy ?? false,
	}));
}

const clock = (time) => new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

async function restart(step, id, outageStarted) {
	running = step;
	const record = { startedAt: Date.now(), finishedAt: null, ok: null, error: null };
	state[step] = record;
	const label = step === "modem" ? "Modem" : "Router";
	try {
		const result = await lights(
			`/plugs/${id}/cycle?wait=true`,
			{ method: "POST", body: JSON.stringify({ reason: `internet down, ${step} recovery` }) },
			CYCLE_TIMEOUT,
		);
		record.ok = result?.ok === true;
		record.error = record.ok ? null : (result?.error ?? "The restart did not finish");
	} catch (error) {
		record.ok = false;
		record.error = error?.message ?? String(error);
	}
	record.finishedAt = Date.now();
	running = null;
	noteOutage(outageStarted, record.ok ? `${label} restarted at ${clock(record.startedAt)}` : `${label} restart failed: ${record.error}`);
	console.log(`Internet recovery: ${label.toLowerCase()} restart ${record.ok ? "done" : `failed, ${record.error}`}`);
}

// When the next step is due, or null when there is nothing left to do this outage
export function nextStep(settings, outage, current = state) {
	const modemOn = settings.modemEnabled && settings.modemPlugId !== null;
	const routerOn = settings.routerEnabled && settings.routerPlugId !== null;
	const due = outage.started + settings.downMinutes * 60 * 1000;
	if (modemOn && !current.modem) return { step: "modem", plugId: settings.modemPlugId, at: due };
	if (routerOn && !current.router) {
		if (!modemOn) return { step: "router", plugId: settings.routerPlugId, at: due };
		if (current.modem?.finishedAt) {
			return { step: "router", plugId: settings.routerPlugId, at: current.modem.finishedAt + settings.gapMinutes * 60 * 1000 };
		}
		return { step: "router", plugId: settings.routerPlugId, at: null };
	}
	return null;
}

async function tick() {
	const outage = currentOutage();
	if (!outage) {
		if (!running) state = { outageStarted: null, modem: null, router: null };
		return;
	}
	if (state.outageStarted !== outage.started) state = { outageStarted: outage.started, modem: null, router: null };
	if (running) return;

	const settings = getRecoverySettings();
	const next = nextStep(settings, outage);
	if (next?.at !== null && next?.at !== undefined && Date.now() >= next.at) {
		// A router that is not answering is a different problem, so nothing restarts until it is back
		if (!(await gatewayAnswers(settings.gatewayHost))) {
			return;
		}
		await restart(next.step, next.plugId, outage.started);
	}
}

export function getRecoveryStatus() {
	const outage = currentOutage();
	const next = outage ? nextStep(getRecoverySettings(), outage) : null;
	return {
		outage: outage ? { started: outage.started } : null,
		running,
		modem: state.modem,
		router: state.router,
		next: next ? { step: next.step, at: next.at } : null,
		gateway,
	};
}

export function startInternetRecovery() {
	setInterval(() => {
		tick().catch((error) => console.log(`Internet recovery failed: ${error?.message}`));
	}, TICK);
}
