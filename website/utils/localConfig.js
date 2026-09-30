import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Machine specific values live here rather than in the code, since the repo is
// public. data/ is gitignored and included in the nightly backup, and
// server-config.example.json at the website root documents every key
const CONFIG_FILE = path.join(__dirname, "../data/server-config.json");

// Neutral fallbacks, so a fresh checkout runs without the private file
const DEFAULTS = {
	backups: {
		dir: path.join(os.homedir(), "Backups", "Server Data Backups"),
		driveLabel: "the backup drive",
	},
	vpn: {
		container: "wireguard",
		adminUrl: "http://localhost:51821",
		profilesDir: path.join(os.homedir(), "Downloads", "VPN Profiles"),
	},
	alerts: {
		ignoreContainers: [],
		watchMounts: [],
	},
};

function merge(base, override) {
	if (!override || typeof override !== "object" || Array.isArray(override)) return base;
	const output = { ...base };
	for (const [key, value] of Object.entries(override)) {
		output[key] =
			base[key] && typeof base[key] === "object" && !Array.isArray(base[key]) ? merge(base[key], value) : value;
	}
	return output;
}

let loaded = null;

// Read once, since everything that uses it is set up at startup. A change to
// the file takes effect on the next restart
export function localConfig() {
	if (loaded) return loaded;

	let saved = {};
	try {
		saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
	} catch (error) {
		if (error.code !== "ENOENT") {
			console.log(`Could not read ${CONFIG_FILE}, using defaults: ${error.message}`);
		}
	}

	loaded = merge(DEFAULTS, saved);
	return loaded;
}
