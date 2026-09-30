import express, { type Express } from "express";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
	TAlertLevel,
	TAlertSettings,
	TDeviceInfo,
	TLight,
	TSettings,
} from "../shared/types";
import { hexToHsv, logAction, validateHexColor } from "./utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lightsFile = path.join(__dirname, "lights.txt");
const climateFile = path.join(__dirname, "climate.txt");
const alertsFile = path.join(__dirname, "alerts.txt");

const alertLevels: TAlertLevel[] = ["ok", "soft", "hard"];

// Soft is purple and hard is red, both at full brightness so they read from
// across the room. Ok means the bulb is simply off
const alertColors: Record<Exclude<TAlertLevel, "ok">, string> = {
	soft: "hsv 300 100 100",
	hard: "hsv 0 100 100",
};

const defaultClimateHosts = ["192.168.1.160", "sht.local"];

// IPs end up in kasa shell commands, so only plain hostnames and IPv4 pass
const hostPattern =
	/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i;
const climateHostPattern =
	/^(?:https?:\/\/)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?$/i;
const macPattern = /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;

export const getAllLights = () => {
	const json = readFileSync(lightsFile, "utf-8");
	const lights = JSON.parse(json || "[]") as TLight[];
	return lights.map((light) => ({
		...light,
		id: Number(light.id),
	}));
};

export const getLightById = (id: number) => {
	return getAllLights().find((light) => light.id === id);
};

export const getLightByMac = (mac: string) => {
	return getAllLights().find(
		(light) => light.mac.toLowerCase() === mac.toLowerCase(),
	);
};

const lightStates: Record<number, TDeviceInfo> = {};

const climate: { temp: number | null; humidity: number | null } = {
	temp: null,
	humidity: null,
};

export const getClimateHosts = () => {
	if (!existsSync(climateFile)) {
		return defaultClimateHosts;
	}

	try {
		const hosts = JSON.parse(readFileSync(climateFile, "utf-8") || "[]");
		return Array.isArray(hosts) ? (hosts as string[]) : defaultClimateHosts;
	} catch (_) {
		return defaultClimateHosts;
	}
};

export const getAlertSettings = (): TAlertSettings => {
	try {
		const saved = JSON.parse(readFileSync(alertsFile, "utf-8") || "{}");
		return {
			enabled: saved?.enabled === true,
			bulbId: Number.isInteger(saved?.bulbId) ? saved.bulbId : null,
		};
	} catch (_) {
		return { enabled: false, bulbId: null };
	}
};

function climateUrl(host: string) {
	return /^https?:\/\//i.test(host) ? host : `http://${host}`;
}

function parseSettings(body: unknown): TSettings | string {
	const input = body as Partial<Record<keyof TSettings, unknown>> | undefined;

	if (!Array.isArray(input?.lights) || !Array.isArray(input?.climateHosts)) {
		return "Expected lights and climateHosts arrays";
	}

	const existing = getAllLights();
	const usedIds = new Set<number>();
	const lights: TSettings["lights"] = [];

	for (const raw of input.lights as Record<string, unknown>[]) {
		const name = String(raw?.name ?? "").trim();
		const ip = String(raw?.ip ?? "").trim();
		const mac = String(raw?.mac ?? "")
			.trim()
			.toUpperCase()
			.replace(/-/g, ":");

		if (!name || name.length > 64) {
			return "Every bulb needs a name of up to 64 characters";
		}
		if (!hostPattern.test(ip)) {
			return `${name} has an invalid IP`;
		}
		if (!macPattern.test(mac)) {
			return `${name} has an invalid MAC address`;
		}
		if (lights.some((light) => light.ip === ip)) {
			return `${ip} is used by more than one bulb`;
		}
		if (lights.some((light) => light.mac === mac)) {
			return `${mac} is used by more than one bulb`;
		}

		// Keep known ids so open cards and cached states still line up
		const id = Number(raw?.id);
		const known =
			Number.isInteger(id) &&
			!usedIds.has(id) &&
			existing.some((light) => light.id === id);

		lights.push({ id: known ? id : Number.NaN, name, ip, mac });
		if (known) {
			usedIds.add(id);
		}
	}

	let nextId =
		Math.max(0, ...existing.map((light) => light.id), ...usedIds) + 1;
	for (const light of lights) {
		if (Number.isNaN(light.id)) {
			light.id = nextId++;
		}
	}

	const climateHosts: string[] = [];
	for (const raw of input.climateHosts) {
		const host = String(raw ?? "")
			.trim()
			.replace(/\/+$/, "");

		if (!climateHostPattern.test(host)) {
			return `${host || "An empty address"} is not a valid climate host`;
		}
		if (!climateHosts.includes(host)) {
			climateHosts.push(host);
		}
	}

	if (!climateHosts.length) {
		return "The climate sensor needs at least one address";
	}

	const rawAlerts = input.alerts as Partial<TAlertSettings> | undefined;
	const bulbId = Number.isInteger(rawAlerts?.bulbId)
		? (rawAlerts?.bulbId as number)
		: null;
	const alerts: TAlertSettings = {
		enabled: rawAlerts?.enabled === true,
		// A bulb removed in the same save stops being the alert bulb
		bulbId: lights.some((light) => light.id === bulbId) ? bulbId : null,
	};

	if (alerts.enabled && alerts.bulbId === null) {
		return "Pick a bulb for server alerts or switch them off";
	}

	return { lights, climateHosts, alerts };
}

async function fetchClimateFrom(host: string) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);
	try {
		const response = await fetch(host, { signal: controller.signal });

		const data = (await response.json()) as {
			temp?: number;
			humidity?: number;
		};

		if (typeof data.temp === "number") {
			climate.temp = data.temp;
		}
		if (typeof data.humidity === "number") {
			climate.humidity = data.humidity;
		}

		return true;
	} finally {
		clearTimeout(timeout);
	}
}

async function fetchClimate() {
	for (const host of getClimateHosts()) {
		try {
			await fetchClimateFrom(climateUrl(host));
			return;
		} catch (_) {
			console.log(`Failed to fetch climate from ${host}`);
		}
	}
}

export function addRoutes(app: Express, email: string, password: string) {
	function getLightStates() {
		const lights = getAllLights();

		for (const light of lights) {
			try {
				const output = execSync(
					`kasa --username ${email} --password '${password}' --host ${light.ip} --json`,
				).toString();

				const parsed = JSON.parse(output);
				const data = parsed?.get_device_info || parsed?.info;
				if (data) {
					lightStates[light.id] = data;
				}
			} catch (_) {
				console.log(
					`Failed to fetch state for light ${light.name} (${light.ip})`,
				);
			}
		}
	}

	function kasa(ip: string, command: string) {
		execSync(
			`kasa --username ${email} --password '${password}' --host ${ip} ${command}`,
		);
	}

	// The last level the server reported, and what is actually on a bulb now.
	// Both start empty, so the first report after a restart always applies
	let alertLevel: TAlertLevel | null = null;
	let shownAlert: { bulbId: number; ip: string; level: TAlertLevel } | null =
		null;

	function syncAlert(req: express.Request) {
		const { enabled, bulbId } = getAlertSettings();
		const bulb = enabled && bulbId !== null ? getLightById(bulbId) : undefined;

		// Alerts moved to another bulb or were switched off, so clear the old one
		if (
			shownAlert &&
			(shownAlert.bulbId !== bulb?.id || shownAlert.ip !== bulb?.ip)
		) {
			if (shownAlert.level !== "ok") {
				try {
					kasa(shownAlert.ip, "off");
				} catch (_) {
					console.log(`Failed to clear alert from ${shownAlert.ip}`);
				}
			}
			delete lightStates[shownAlert.bulbId];
			shownAlert = null;
		}

		if (!bulb || !alertLevel) {
			return false;
		}
		if (shownAlert?.level === alertLevel) {
			return true;
		}

		try {
			kasa(bulb.ip, alertLevel === "ok" ? "off" : alertColors[alertLevel]);
			shownAlert = { bulbId: bulb.id, ip: bulb.ip, level: alertLevel };
			delete lightStates[bulb.id];
			logAction(`Server alert ${alertLevel} shown on ${bulb.name}`, req);
			return true;
		} catch (_) {
			// Left unrecorded so the next report tries again
			console.log(`Failed to show server alert on ${bulb.name}`);
			return false;
		}
	}

	getLightStates();

	setInterval(() => {
		getLightStates();
	}, 15_000);

	fetchClimate();

	setInterval(() => {
		fetchClimate();
	}, 30_000);

	app.get("/api/lights", async (_, res) => {
		res.json(getAllLights());
	});

	app.get("/api/climate", async (_, res) => {
		res.json(climate);
	});

	app.get("/api/settings", (_, res) => {
		const settings: TSettings = {
			lights: getAllLights(),
			climateHosts: getClimateHosts(),
			alerts: getAlertSettings(),
			alertLevel,
		};
		res.json(settings);
	});

	app.put("/api/settings", express.json(), (req, res) => {
		const settings = parseSettings(req.body);

		if (typeof settings === "string") {
			return res.status(400).json({ error: settings });
		}

		const previous = getAllLights();

		try {
			writeFileSync(lightsFile, JSON.stringify(settings.lights, null, 4));
			writeFileSync(
				climateFile,
				JSON.stringify(settings.climateHosts, null, 4),
			);
			writeFileSync(alertsFile, JSON.stringify(settings.alerts, null, 4));
		} catch (error) {
			console.log(error);
			return res.status(500).json({ error: "Failed to save settings" });
		}

		// Drop cached states for bulbs that were removed or now point elsewhere
		for (const old of previous) {
			const current = settings.lights.find((light) => light.id === old.id);
			if (!current || current.ip !== old.ip) {
				delete lightStates[old.id];
			}
		}

		logAction(
			`Saved settings with ${settings.lights.length} bulbs and climate hosts ${settings.climateHosts.join(", ")}`,
			req,
		);

		fetchClimate();
		syncAlert(req);

		return res.json({ ...settings, alertLevel });
	});

	// The server monitor only ever sends a level. Which bulb shows it, and
	// whether it shows at all, is decided here
	app.post("/api/alerts", express.json(), (req, res) => {
		const level = req.body?.level as TAlertLevel;

		if (!alertLevels.includes(level)) {
			return res
				.status(400)
				.json({ error: "Level must be one of ok, soft or hard" });
		}

		alertLevel = level;
		const shown = syncAlert(req);
		const { enabled } = getAlertSettings();

		return res.json({ level, enabled, shown });
	});

	app.get("/api/lights/restart", (req, res) => {
		logAction("Restarted lights service", req);
		execSync("pm2 restart lights");
		res.json({ success: true });
	});

	app.get("/api/lights/:id/state", async (req, res) => {
		try {
			const { id } = req.params;
			const initial = req.query.initial === "true";
			const light = getLightById(Number(id));

			if (!light) {
				return res.status(404).json({ error: "Light not found" });
			}

			if (initial && lightStates[light.id]) {
				return res.json(lightStates[light.id]);
			}

			const output = execSync(
				`kasa --username ${email} --password '${password}' --host ${light.ip} --json`,
			).toString();

			const data = JSON.parse(output)?.get_device_info;
			res.json(data);
		} catch (error) {
			console.log(error);
			return res.status(500).json({ error: "Failed to get light state" });
		}
	});

	app.get("/api/lights/:id/power/on", async (req, res) => {
		try {
			const { id } = req.params;
			const light = getLightById(Number(id));

			if (!light) {
				return res.status(404).json({ error: "Light not found" });
			}

			logAction(`Turning on light ${light.name} (${light.ip})`, req);
			execSync(
				`kasa --username ${email} --password '${password}' --host ${light.ip} on`,
			);
		} catch (_) {
			return res.status(500).json({ error: "Failed to turn on light" });
		}
		res.json({ success: true });
	});

	app.get("/api/lights/:id/power/off", async (req, res) => {
		try {
			const { id } = req.params;
			const light = getLightById(Number(id));

			if (!light) {
				return res.status(404).json({ error: "Light not found" });
			}

			logAction(`Turning off light ${light.name} (${light.ip})`, req);
			execSync(
				`kasa --username ${email} --password '${password}' --host ${light.ip} off`,
			);
		} catch (_) {
			return res.status(500).json({ error: "Failed to turn on light" });
		}
		res.json({ success: true });
	});

	app.get("/api/lights/:id/color/:hex", async (req, res) => {
		const { id, hex } = req.params;
		const light = getLightById(Number(id));

		if (!light) {
			return res.status(404).json({ error: "Light not found" });
		}

		const color = !hex.startsWith("#") ? `#${hex}` : hex;

		if (!validateHexColor(color)) {
			return res.status(400).json({ error: "Invalid hex color" });
		}

		const hsv = hexToHsv(color);
		if (!hsv) {
			return res.status(500).json({ error: "Failed to convert hex to HSV" });
		}

		try {
			logAction(
				`Setting color of light ${light.name} (${light.ip}) to ${color}`,
				req,
			);
			execSync(
				`kasa --username ${email} --password '${password}' --host ${light.ip} hsv ${hsv.h} ${hsv.s} ${hsv.v}`,
			);
		} catch (_) {
			return res.status(500).json({ error: "Failed to set light color" });
		}

		return res.json({ success: true, color, hsv });
	});

	app.get("/api/lights/:id/brightness/:value", async (req, res) => {
		const { id, value } = req.params;
		const light = getLightById(Number(id));
		const brightness = Number(value);

		if (!light) {
			return res.status(404).json({ error: "Light not found" });
		}

		if (Number.isNaN(brightness) || brightness < 1 || brightness > 100) {
			return res
				.status(400)
				.json({ error: "Brightness must be a number between 1 and 100" });
		}

		try {
			logAction(
				`Setting brightness of light ${light.name} (${light.ip}) to ${brightness}`,
				req,
			);
			execSync(
				`kasa --username ${email} --password '${password}' --host ${light.ip} brightness ${brightness}`,
			);
		} catch (_) {
			return res.status(500).json({ error: "Failed to set light brightness" });
		}

		return res.json({ success: true, brightness });
	});
}
