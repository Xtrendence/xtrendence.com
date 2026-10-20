import { currentOutage } from "./history.js";
import { collectServerStats, restartVpn } from "./serverStats.js";
import { sendBotNotification, sudoExecSync } from "./utils.js";

// Watchdogs for the Cloudflare tunnel and the VPN, each restarts its service when it has quietly stopped working

const MINUTE = 60 * 1000;
const PUBLIC_URL = "https://xtrendence.com/";
const LOCAL_URL = "http://localhost/";

const TUNNEL_FAILURES = 3;
const TUNNEL_COOLDOWN = 15 * MINUTE;
const VPN_FAILURES = 2;
const VPN_COOLDOWN = 30 * MINUTE;
// Peers count as active with a handshake this recent, WireGuard renews every two minutes while in use
const PEER_ACTIVE = 3 * MINUTE;
// Two or more peers going quiet within this window looks like the server side, not people leaving
const PEERS_DROPPED_TOGETHER = 4 * MINUTE;

const state = {
	tunnel: { failures: 0, lastRestart: 0, lastError: null },
	vpn: { failures: 0, lastRestart: 0, active: new Map() },
	log: [],
};

function record(service, message) {
	state.log = [{ at: Date.now(), service, message }, ...state.log].slice(0, 20);
	console.log(`Self healing: ${message}`);
}

export function restartCloudflared() {
	sudoExecSync("systemctl restart cloudflared");
}

async function answers(url) {
	try {
		const response = await fetch(url, {
			redirect: "manual",
			signal: AbortSignal.timeout(15000),
			headers: { "User-Agent": "xtrendence-self-healing" },
		});
		const body = response.status >= 500 ? await response.text().catch(() => "") : "";
		// 5xx from Cloudflare itself, like 530 when the tunnel is down, is a tunnel problem
		if (response.status >= 500) return { ok: false, error: `HTTP ${response.status}${/cf-error|cloudflare/i.test(body) ? " from Cloudflare" : ""}` };
		return { ok: true, error: null };
	} catch (error) {
		return { ok: false, error: error?.cause?.code ?? error?.message ?? "No answer" };
	}
}

// Only a tunnel fault counts, so the internet and the site itself both have to be fine
async function checkTunnel() {
	if (currentOutage() || currentOutage("router")) {
		state.tunnel.failures = 0;
		return;
	}
	const [local, remote] = await Promise.all([answers(LOCAL_URL), answers(PUBLIC_URL)]);
	if (!local.ok || remote.ok) {
		state.tunnel.failures = 0;
		state.tunnel.lastError = remote.ok ? null : state.tunnel.lastError;
		return;
	}

	state.tunnel.failures += 1;
	state.tunnel.lastError = remote.error;
	if (state.tunnel.failures < TUNNEL_FAILURES || Date.now() - state.tunnel.lastRestart < TUNNEL_COOLDOWN) return;

	state.tunnel.failures = 0;
	state.tunnel.lastRestart = Date.now();
	try {
		restartCloudflared();
		record("cloudflared", `restarted cloudflared, ${PUBLIC_URL} was failing (${remote.error}) while the site answered locally`);
		setTimeout(async () => {
			const after = await answers(PUBLIC_URL);
			sendBotNotification({
				title: "Cloudflare tunnel restarted",
				body: `xtrendence.com was unreachable through the tunnel (${remote.error}) for ${TUNNEL_FAILURES} minutes while the site worked locally, so cloudflared was restarted. ${after.ok ? "It is reachable again." : `It is still failing (${after.error}).`}`,
			});
		}, MINUTE);
	} catch (error) {
		record("cloudflared", `could not restart cloudflared: ${error?.message}`);
	}
}

async function restartVpnFor(reason) {
	state.vpn.failures = 0;
	state.vpn.lastRestart = Date.now();
	state.vpn.active.clear();
	try {
		await restartVpn();
		record("vpn", `restarted the VPN, ${reason}`);
		sendBotNotification({ title: "VPN restarted", body: `The VPN was restarted because ${reason}.` });
	} catch (error) {
		record("vpn", `could not restart the VPN: ${error?.message}`);
	}
}

async function checkVpn() {
	const vpn = (await collectServerStats()).vpn;
	if (!vpn?.installed || currentOutage() || currentOutage("router")) return;
	const cooling = Date.now() - state.vpn.lastRestart < VPN_COOLDOWN;

	// Running but not listening, the clearest sign it is broken
	if (vpn.state === "running" && !vpn.up) {
		state.vpn.failures += 1;
		if (state.vpn.failures >= VPN_FAILURES && !cooling) await restartVpnFor("its container was running but WireGuard was not listening");
		return;
	}
	state.vpn.failures = 0;

	// Several peers that were in use all going silent together points at the server, one alone is just someone leaving
	const now = Date.now();
	const handshakes = (vpn.peers ?? []).map((peer) => [peer.name, peer.lastHandshake ? new Date(peer.lastHandshake).getTime() : 0]);
	const active = handshakes.filter(([, time]) => now - time < PEER_ACTIVE);
	for (const [name, time] of active) state.vpn.active.set(name, time);
	const dropped = [...state.vpn.active.entries()].filter(([name]) => !active.some(([activeName]) => activeName === name));
	if (active.length === 0 && dropped.length >= 2) {
		const times = dropped.map(([, time]) => time);
		const together = Math.max(...times) - Math.min(...times) < PEERS_DROPPED_TOGETHER;
		state.vpn.active.clear();
		if (together && !cooling) await restartVpnFor(`${dropped.length} connected devices all stopped handshaking at the same time`);
		return;
	}
	for (const [name] of dropped) state.vpn.active.delete(name);
}

export function getHealingStatus() {
	return {
		tunnel: { failures: state.tunnel.failures, lastRestart: state.tunnel.lastRestart || null, lastError: state.tunnel.lastError },
		vpn: { lastRestart: state.vpn.lastRestart || null },
		log: state.log,
	};
}

export function startSelfHealing() {
	const run = (name, check) => check().catch((error) => console.log(`Self healing ${name} check failed: ${error?.message}`));
	setTimeout(() => {
		run("tunnel", checkTunnel);
		run("vpn", checkVpn);
	}, 2 * MINUTE);
	setInterval(() => run("tunnel", checkTunnel), MINUTE);
	setInterval(() => run("vpn", checkVpn), MINUTE);
}
