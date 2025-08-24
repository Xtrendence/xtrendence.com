import type { Express } from "express";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TDeviceInfo, TLight } from "../shared/types";
import { hexToHsv, validateHexColor } from "./utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lightsFile = path.join(__dirname, "lights.txt");

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
	return getAllLights().find((light) => light.mac === mac);
};

const lightStates: Record<number, TDeviceInfo> = {};

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

	getLightStates();

	setInterval(() => {
		getLightStates();
	}, 15_000);

	app.get("/api/lights", async (_, res) => {
		res.json(getAllLights());
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
			execSync(
				`kasa --username ${email} --password '${password}' --host ${light.ip} brightness ${brightness}`,
			);
		} catch (_) {
			return res.status(500).json({ error: "Failed to set light brightness" });
		}

		return res.json({ success: true, brightness });
	});
}
