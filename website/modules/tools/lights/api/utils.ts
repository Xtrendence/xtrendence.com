import axios from "axios";
import type { Request } from "express";
import { appendFile, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function verifyToken(token: string) {
	return new Promise((resolve, _) => {
		if (!token) {
			resolve(false);
			return;
		}

		axios
			.post("http://localhost:3002/verify", {
				token,
			})
			.then((response) => {
				if (response?.data?.valid === true) {
					resolve(true);
					return;
				}

				resolve(false);
				return;
			})
			.catch((error) => {
				console.log(error);
				resolve(false);
				return;
			});
	});
}

export function validJSON(str: string) {
	try {
		JSON.parse(str);
	} catch (_) {
		return false;
	}
	return true;
}

export function getBody(req: Request) {
	return new Promise((resolve, reject) => {
		if (req.body && Object.keys(req.body).length > 0) {
			resolve(req.body);
			return;
		}

		req.on("data", (data) => {
			const body = data.toString();
			if (validJSON(body)) {
				const parsed = JSON.parse(body);
				resolve(parsed);
				return;
			}

			reject({
				error: "Invalid JSON.",
				body,
			});
		});

		req.on("error", (error) => {
			reject(error);
			return;
		});

		setTimeout(() => {
			reject({
				error: "Request timed out.",
			});
			return;
		}, 5000);
	});
}

export function validateHexColor(hex: string) {
	return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
}

export function hexToHsv(hex: string) {
	const valid = validateHexColor(hex);
	if (!valid) {
		console.error("Invalid hex color:", hex);
		return;
	}
	const normalized = hex.replace(/^#/, "");
	const hexArr =
		normalized.length === 3
			? normalized.split("").map((c) => c + c)
			: (normalized.match(/.{2}/g) ?? []);

	if (hexArr.length !== 3) {
		throw new Error("Invalid hex color");
	}

	const [r, g, b] = hexArr.map((c) => Number(`0x${c}`) / 255);

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;

	const h =
		delta === 0
			? 0
			: max === r
				? 60 * (((g - b) / delta) % 6)
				: max === g
					? 60 * ((b - r) / delta + 2)
					: 60 * ((r - g) / delta + 4);

	const s = max === 0 ? 0 : delta / max;
	const v = max;

	return {
		h: Math.round((h + 360) % 360),
		s: Math.round(s * 100),
		v: Math.round(v * 100),
	};
}

export function logAction(action: string, req: Request) {
	const ip =
		req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
	const logFile = path.join(__dirname, "actions.log");

	// If the log file is larger than 5MB, empty it.
	try {
		const filesize = statSync(logFile).size;
		if (filesize > 5 * 1024 * 1024) {
			writeFileSync(logFile, "");
		}
	} catch (err) {
		// File might not exist yet, ignore error.
	}

	const timestamp = new Date().toISOString();
	const logEntry = `${timestamp} - ${ip} - ${action}\n`;

	appendFile(logFile, logEntry, (err) => {
		if (err) {
			console.error("Failed to write log entry:", err);
		}
	});
}
