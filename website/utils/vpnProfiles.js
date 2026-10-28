import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import QRCode from "qrcode-svg";
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

// The VPN server writes the same AllowedIPs into every profile, the LAN only
// one. A name ending in _FULL marks a profile that sends all traffic through
// home instead, which still includes the LAN. IPv6 goes in too, since this
// network has none, so it cannot leak out around the tunnel
export const TUNNELS = {
	lan: { suffix: "_LAN", label: "LAN only" },
	full: { suffix: "_FULL", label: "All traffic" },
};
const FULL_ALLOWED_IPS = "0.0.0.0/0, ::/0";

export function tunnelOf(name) {
	return String(name).endsWith(TUNNELS.full.suffix) ? "full" : "lan";
}

function tunnelConfig(name, config) {
	if (tunnelOf(name) !== "full") return config;
	return config.replace(/^AllowedIPs\s*=.*$/m, `AllowedIPs = ${FULL_ALLOWED_IPS}`);
}

// Drawn here from the final config, since the VPN server's own QR code always
// has the LAN only AllowedIPs in it
function qrFor(config) {
	return new QRCode({
		content: config,
		ecl: "M",
		padding: 2,
		width: 360,
		height: 360,
		color: "#000000",
		background: "#ffffff",
		join: true,
	}).svg();
}

async function clientConfig(client) {
	const config = await (await api(`/client/${client.id}/configuration`)).text();
	return tunnelConfig(client.name, config);
}

let syncing = null;

// wg-easy v15 takes Basic auth on its API. The admin login lives only in the container's
// environment (from the .env beside its compose file), so it is read from there on demand
async function adminAuth() {
	const { stdout } = await run("docker", [
		"inspect",
		VPN_CONTAINER,
		"--format",
		"{{range .Config.Env}}{{println .}}{{end}}",
	]);
	const value = (key) => stdout.split("\n").find((entry) => entry.startsWith(`${key}=`))?.slice(key.length + 1);
	const username = value("INIT_USERNAME");
	const password = value("INIT_PASSWORD");
	if (!username || !password) throw new Error("The VPN admin login is not in the container's environment");
	return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function api(route, options = {}) {
	const response = await fetch(`${ADMIN_URL}/api${route}`, {
		...options,
		headers: { ...(options.headers ?? {}), Authorization: await adminAuth() },
		signal: AbortSignal.timeout(15000),
	});
	if (!response.ok) throw new Error(`VPN admin ${route} failed with ${response.status}`);
	return response;
}

async function listClients() {
	const response = await api("/client");
	return response.json();
}

// v15 numbers its clients
const validId = (id) => /^\d{1,9}$/.test(String(id));

// For the dashboard's peer list, public keys to names, nothing secret leaves here
export async function vpnPeers() {
	const peers = new Map();
	for (const client of await listClients()) {
		peers.set(client.publicKey, { id: String(client.id), name: client.name, address: client.ipv4Address, enabled: client.enabled });
	}
	return peers;
}

function writePrivate(file, data) {
	fs.writeFileSync(file, data, { mode: 0o600 });
	fs.chmodSync(file, 0o600);
}

// Writes every live profile and deletes files for ones that no longer exist
async function syncFolder() {
	fs.mkdirSync(PROFILES_DIR, { recursive: true, mode: 0o700 });

	const clients = await listClients();
	const live = new Set();

	for (const client of clients) {
		if (!NAME_PATTERN.test(client.name)) continue;
		live.add(client.name);

		const config = await clientConfig(client);

		writePrivate(path.join(PROFILES_DIR, `${client.name}.conf`), config);
		writePrivate(path.join(PROFILES_DIR, `${client.name}-qr.svg`), qrFor(config));
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
		syncing = syncFolder().finally(() => {
				syncing = null;
			});
	}
	return syncing;
}

// The chosen tunnel decides the suffix, replacing one typed by hand so a name
// can never claim one type and be the other
export async function createProfile(rawName, tunnel = "lan") {
	const kind = TUNNELS[tunnel] ? tunnel : "lan";
	let base = String(rawName ?? "").trim();
	for (const { suffix } of Object.values(TUNNELS)) {
		if (base.toUpperCase().endsWith(suffix)) base = base.slice(0, -suffix.length);
	}
	const name = `${base}${TUNNELS[kind].suffix}`;
	if (!base || !NAME_PATTERN.test(name)) {
		throw new Error("Names can use letters, numbers, spaces, dashes and underscores, up to 27 characters before the suffix");
	}

	const clients = await listClients();
	if (clients.some((client) => client.name.toLowerCase() === name.toLowerCase())) {
		throw new Error(`A profile called ${name} already exists`);
	}

	await api("/client", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, expiresAt: null }),
	});

	await syncFolder();
	return name;
}

// The QR code embeds the profile's private key, so the route that calls this
// asks for the server password first
export async function getProfileQr(id) {
	if (!validId(id)) {
		throw new Error("Unknown profile");
	}

	const clients = await listClients();
	const client = clients.find((entry) => String(entry.id) === String(id));
	if (!client) throw new Error("Unknown profile");

	return { name: client.name, svg: qrFor(await clientConfig(client)) };
}

// Same as the QR code, the route that calls this asks for the server password first
export async function getProfileConfig(id) {
	if (!validId(id)) {
		throw new Error("Unknown profile");
	}

	const clients = await listClients();
	const client = clients.find((entry) => String(entry.id) === String(id));
	if (!client) throw new Error("Unknown profile");

	return { name: client.name, config: await clientConfig(client) };
}

// Removing the client drops its peer from WireGuard, so the key stops
// working straight away, then its files leave the folder
export async function removeProfile(id) {
	if (!validId(id)) {
		throw new Error("Unknown profile");
	}

	const clients = await listClients();
	const client = clients.find((entry) => String(entry.id) === String(id));
	if (!client) throw new Error("Unknown profile");

	await api(`/client/${client.id}`, { method: "DELETE" });
	await syncFolder();
	return client.name;
}
