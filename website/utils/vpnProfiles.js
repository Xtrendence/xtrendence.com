import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { localConfig } from "./localConfig.js";

const run = promisify(execFile);

const VPN_CONTAINER = localConfig().vpn.container;
const ADMIN_URL = localConfig().vpn.adminUrl;

// Mirrors the currently valid profiles. Anything in here that is not a live
// profile's .conf or QR code is left alone, so other files are safe
export const PROFILES_DIR = localConfig().vpn.profilesDir;

// Names become file names, so they are kept to characters that are safe there
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,31}$/;

const PROFILE_FILE = /^(.+?)(\.conf|-qr\.svg)$/;

let syncing = null;

// The admin password lives only in the container's environment, so it is
// read from there on demand rather than copied into the website's .env
async function adminPassword() {
	const { stdout } = await run("docker", [
		"inspect",
		VPN_CONTAINER,
		"--format",
		"{{range .Config.Env}}{{println .}}{{end}}",
	]);
	const line = stdout.split("\n").find((entry) => entry.startsWith("PASSWORD="));
	if (!line) throw new Error("The VPN admin has no password set");
	return line.slice("PASSWORD=".length);
}

async function session() {
	const response = await fetch(`${ADMIN_URL}/api/session`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ password: await adminPassword() }),
	});
	if (!response.ok) throw new Error(`VPN admin login failed with ${response.status}`);
	const cookie = response.headers.get("set-cookie")?.split(";")[0];
	if (!cookie) throw new Error("The VPN admin did not return a session");
	return cookie;
}

async function api(cookie, route, options = {}) {
	const response = await fetch(`${ADMIN_URL}/api${route}`, {
		...options,
		headers: { ...(options.headers ?? {}), Cookie: cookie },
	});
	if (!response.ok) throw new Error(`VPN admin ${route} failed with ${response.status}`);
	return response;
}

async function listClients(cookie) {
	const response = await api(cookie, "/wireguard/client");
	return response.json();
}

function writePrivate(file, data) {
	fs.writeFileSync(file, data, { mode: 0o600 });
	fs.chmodSync(file, 0o600);
}

// Writes every live profile and deletes files for ones that no longer exist
async function syncFolder(cookie) {
	fs.mkdirSync(PROFILES_DIR, { recursive: true, mode: 0o700 });

	const clients = await listClients(cookie);
	const live = new Set();

	for (const client of clients) {
		if (!NAME_PATTERN.test(client.name)) continue;
		live.add(client.name);

		const config = await (await api(cookie, `/wireguard/client/${client.id}/configuration`)).text();
		const qr = await (await api(cookie, `/wireguard/client/${client.id}/qrcode.svg`)).text();

		writePrivate(path.join(PROFILES_DIR, `${client.name}.conf`), config);
		writePrivate(path.join(PROFILES_DIR, `${client.name}-qr.svg`), qr);
	}

	for (const file of fs.readdirSync(PROFILES_DIR)) {
		const match = file.match(PROFILE_FILE);
		if (match && !live.has(match[1])) {
			fs.rmSync(path.join(PROFILES_DIR, file));
		}
	}

	return clients;
}

// Overlapping callers share one sync
export function syncProfiles() {
	if (!syncing) {
		syncing = session()
			.then(syncFolder)
			.finally(() => {
				syncing = null;
			});
	}
	return syncing;
}

export async function createProfile(rawName) {
	const name = String(rawName ?? "").trim();
	if (!NAME_PATTERN.test(name)) {
		throw new Error("Names can use letters, numbers, spaces, dashes and underscores, up to 32 characters");
	}

	const cookie = await session();
	const clients = await listClients(cookie);
	if (clients.some((client) => client.name.toLowerCase() === name.toLowerCase())) {
		throw new Error(`A profile called ${name} already exists`);
	}

	await api(cookie, "/wireguard/client", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	});

	await syncFolder(cookie);
	return name;
}

// The QR code embeds the profile's private key, so the route that calls this
// asks for the server password first
export async function getProfileQr(id) {
	if (!/^[0-9a-f-]{36}$/i.test(String(id))) {
		throw new Error("Unknown profile");
	}

	const cookie = await session();
	const clients = await listClients(cookie);
	const client = clients.find((entry) => entry.id === id);
	if (!client) throw new Error("Unknown profile");

	const svg = await (await api(cookie, `/wireguard/client/${id}/qrcode.svg`)).text();
	return { name: client.name, svg };
}

// Removing the client drops its peer from WireGuard, so the key stops
// working straight away, then its files leave the folder
export async function removeProfile(id) {
	if (!/^[0-9a-f-]{36}$/i.test(String(id))) {
		throw new Error("Unknown profile");
	}

	const cookie = await session();
	const clients = await listClients(cookie);
	const client = clients.find((entry) => entry.id === id);
	if (!client) throw new Error("Unknown profile");

	await api(cookie, `/wireguard/client/${id}`, { method: "DELETE" });
	await syncFolder(cookie);
	return client.name;
}
