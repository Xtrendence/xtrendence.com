import express from "express";
import { execSync } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode-svg";
import {
	checkNow,
	getAlertStatus,
	getRules,
	saveRules,
	sendNotificationNow,
} from "./serverAlerts.js";
import { getBackupStatus, listBackupDrives, planBackup, setBackupDrive, startBackup } from "./backups.js";
import { cancelDrill, drillRunning, getDrillStatus, startDrill } from "./restoreDrill.js";
import { getHistory, getSnapshot, getTimeline } from "./history.js";
import { getHealingStatus, restartCloudflared } from "./selfHealing.js";
import {
	getRecoverySettings,
	getRecoveryStatus,
	lights as lightsApi,
	LIMITS as RECOVERY_LIMITS,
	listPlugs,
	parseRecoverySettings,
	saveRecoverySettings,
} from "./internetRecovery.js";
import { buildAliases, redactHistory, redactRules, redactStats } from "./viewRedaction.js";
import {
	VIEW_COOKIE,
	activeShareCodes,
	createShareCode,
	redeemPin,
	stopSharing,
	viewSession,
} from "./serverShare.js";
import { createProfile, getProfileQr, removeProfile } from "./vpnProfiles.js";
import {
	collectServerStats,
	forgetVpn,
	getVpn,
	listContainers,
	listMounts,
	restartContainer,
	restartService,
	restartVpn,
} from "./serverStats.js";
import { logout, sendBotNotification, sudoExecSync, verifyToken } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const visitorsFile = path.join(__dirname, "../visitors.txt");

// ACME challenges for SSL certificate renewal.
const challenges = [
	{
		data: "xEYQ7UfI4PQ9BPr04E5HvpDsrYBykeBcNz4DGNpFL-E.4Q2WT1EKuJWpxONTEpneUbSagIFkQbvcaiiSWyV39oM",
		url: "xEYQ7UfI4PQ9BPr04E5HvpDsrYBykeBcNz4DGNpFL-E",
	},
	{
		data: "oY4fQ8RE_SF1Go2NqOcT71q0AddL-mnqzD0n5SJXmMs.4Q2WT1EKuJWpxONTEpneUbSagIFkQbvcaiiSWyV39oM",
		url: "oY4fQ8RE_SF1Go2NqOcT71q0AddL-mnqzD0n5SJXmMs",
	},
];

// What the name lists on the alert rules can pick from
async function listChoices() {
	const [containers, mounts] = await Promise.all([listContainers(), listMounts()]);
	return {
		containers,
		mounts: mounts.map((entry) => entry.mount).filter((mount) => mount !== "/"),
	};
}

// Hashed first, since timingSafeEqual needs equal lengths
function serverPasswordMatches(attempt) {
	const expected = Buffer.from(process.env.SERVER_PASSWORD ?? "", "base64").toString("utf-8");
	if (!expected) return false;
	const hash = (value) => createHash("sha256").update(String(value ?? "")).digest();
	return timingSafeEqual(hash(attempt), hash(expected));
}

const QR_MAX_FAILURES = 5;
const QR_LOCKOUT = 15 * 60 * 1000;
let qrFailures = [];

// Owners are logged in, viewers hold a share code session
async function serverAccess(req) {
	if (await verifyToken(req.cookies.token)) return { role: "owner" };
	const session = viewSession(req);
	return session ? { role: "viewer", expiresAt: session.expiresAt } : null;
}

// Cloudflare's header, else the last X-Forwarded-For entry, else the socket
function clientIp(req) {
	const cloudflare = req.headers["cf-connecting-ip"];
	if (cloudflare) return String(cloudflare).trim();

	const forwarded = String(req.headers["x-forwarded-for"] ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	if (forwarded.length) return forwarded.at(-1);

	return String(req.socket.remoteAddress ?? "unknown");
}

export function setRoutes(app) {
	app.use("/", express.static("public"));

	app.get("/", (_, res) => {
		res.render("pages/index");
	});

	// Hashes the visitor's IP address, and saves it to visitors.txt if it doesn't exist already. This is used for the visitor counter on the homepage.
	app.get("/visitor", async (req, res) => {
		const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
		const sha = createHash("sha256").update(ip).digest("hex");
		const visitors = fs.existsSync(visitorsFile)
			? fs.readFileSync(visitorsFile, "utf-8").split("\n")
			: [];

		if (!visitors.includes(sha)) {
			fs.appendFileSync(visitorsFile, `${sha}\n`);
		}

		res.json({ count: visitors.length - 1 });
	});

	app.get("/tools", async (req, res) => {
		const token = req.cookies.token;

		const validToken = await verifyToken(token);

		if (!validToken) {
			res
				.status(401)
				.send(
					'<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>',
				);
			return;
		}

		res.render("pages/tools");
	});

	app.get("/login", async (req, res) => {
		const token = req.cookies.token;

		const validToken = await verifyToken(token);

		if (validToken) {
			res.redirect("/");
			return;
		}

		res.render("pages/login");
	});

	app.get("/account", async (req, res) => {
		const token = req.cookies.token;

		const validToken = await verifyToken(token);

		if (!validToken) {
			res
				.status(401)
				.send(
					'<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>',
				);
			return;
		}

		res.render("pages/account");
	});

	app.get("/logout", async (req, res) => {
		const token = req.cookies.token;
		await logout(token);
		res.clearCookie("token");
		res.redirect("/");
	});

	// For restarting Docker.
	app.get("/docker", async (req, res) => {
		const token = req.cookies.token;

		const validToken = await verifyToken(token);

		if (!validToken) {
			res
				.status(401)
				.send(
					'<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>',
				);
			return;
		}

		try {
			sudoExecSync("sh /media/T7/Media\\ Server/ipv6.sh");
			res.send("Docker restarted successfully.");
		} catch (error) {
			console.error("Error restarting Docker:", error);
			res.status(500).send("Error restarting Docker");
			return;
		}
	});

	app.get("/wifi", async (req, res) => {
		const token = req.cookies.token;

		const validToken = await verifyToken(token);

		if (!validToken) {
			res
				.status(401)
				.send(
					'<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>',
				);
			return;
		}

		const wpa = process.env.WIFI_WPA || "";
		const network = process.env.WIFI_NETWORK || "";
		const type = process.env.WIFI_TYPE || "";

		const qr = `WIFI:T:${type};S:${network};P:${wpa};;`;

		const qrcode = new QRCode({
			background: "#0000",
			color: "#fff",
			content: qr,
			ecl: "H",
			padding: 0,
		});

		const svg = qrcode.svg();

		res.render("pages/wifi", { svg, qr });
	});

	app.get("/server", async (req, res) => {
		// Swaps the PIN for a session cookie and drops it from the URL
		if (req.query.pin !== undefined) {
			const result = redeemPin(String(req.query.pin), clientIp(req));
			if (result.error) {
				res.status(403).render("pages/error", { code: "403", message: result.error, status: "Forbidden" });
				return;
			}
			res.cookie(VIEW_COOKIE, result.token, {
				httpOnly: true,
				sameSite: "lax",
				secure: req.headers["x-forwarded-proto"] === "https",
				path: "/server",
				expires: new Date(result.expiresAt),
			});
			res.redirect("/server");
			return;
		}

		const access = await serverAccess(req);

		if (!access) {
			res
				.status(401)
				.send(
					'<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>',
				);
			return;
		}

		res.set("Cache-Control", "no-store");
		res.render("pages/server", {
			viewOnly: access.role === "viewer",
			viewExpiresAt: access.expiresAt ?? null,
			appName: process.env.name ?? null,
		});
	});

	app.get("/server/share", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		res.set("Cache-Control", "no-store");
		res.json({ codes: activeShareCodes() });
	});

	app.post("/server/share", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		const code = createShareCode();
		console.log(`Created a server share code, expires ${new Date(code.expiresAt).toISOString()}`);
		res.set("Cache-Control", "no-store");
		res.json({
			pin: code.pin,
			expiresAt: code.expiresAt,
			url: `https://www.xtrendence.com/server?pin=${code.pin}`,
		});
	});

	app.delete("/server/share", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		stopSharing();
		console.log("Stopped all server sharing");
		res.json({ stopped: true });
	});

	// Read only health metrics, the client cannot influence what gets run
	app.get("/server/stats", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			const stats = { ...(await collectServerStats()), alerts: getAlertStatus() };
			res.set("Cache-Control", "no-store");
			res.json(access.role === "viewer" ? redactStats(stats, buildAliases(stats)) : stats);
		} catch (error) {
			console.error("Error collecting server stats:", error);
			res.status(500).json({ error: "Failed to collect server stats" });
		}
	});

	app.get("/server/timeline", async (req, res) => {
		if (!(await serverAccess(req))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		res.set("Cache-Control", "no-store");
		res.json(getTimeline(String(req.query.range ?? "24h")));
	});

	// Redacted for viewers like /server/stats, with aliases from that moment
	app.get("/server/snapshot", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		const time = Number(req.query.t);
		if (!Number.isFinite(time)) {
			res.status(400).json({ error: "Expected a time" });
			return;
		}

		try {
			const snapshot = getSnapshot(time);
			if (!snapshot) {
				res.status(404).json({ error: "No snapshots recorded yet" });
				return;
			}
			res.set("Cache-Control", "no-store");
			const stats =
				access.role === "viewer" ? redactStats(snapshot.stats, buildAliases(snapshot.stats)) : snapshot.stats;
			res.json({ t: snapshot.t, stats });
		} catch (error) {
			console.error("Error reading snapshot:", error);
			res.status(500).json({ error: "Failed to read snapshot" });
		}
	});

	app.get("/server/alerts", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		res.set("Cache-Control", "no-store");
		const payload = {
			rules: getRules(),
			status: getAlertStatus(),
			choices: await listChoices(),
		};
		if (access.role === "viewer") {
			res.json(redactRules(payload, buildAliases(await collectServerStats(), payload.choices.mounts)));
			return;
		}
		res.json(payload);
	});

	// Saving runs a check straight away so the light reflects the new rules
	app.put("/server/alerts", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			saveRules(req.body?.rules);
		} catch (error) {
			res.status(400).json({ error: error.message });
			return;
		}

		const status = await checkNow({ fresh: true });
		res.json({
			rules: getRules(),
			status,
			choices: await listChoices(),
		});
	});

	app.post("/server/alerts/check", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		res.json({ status: await checkNow({ fresh: true }) });
	});

	app.post("/server/alerts/notify", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		const result = await sendNotificationNow();
		if (!result.sent) {
			res.status(502).json({ error: "The bot did not accept the notification" });
			return;
		}

		res.json({ sent: true, status: getAlertStatus() });
	});

	// Rechecks after, so the page and light catch up
	app.post("/server/vpn/restart", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			await restartVpn();
		} catch (error) {
			console.error("Error restarting the VPN:", error);
			res.status(500).json({ error: "Failed to restart the VPN" });
			return;
		}

		const status = await checkNow({ fresh: true });
		res.json({ vpn: await getVpn(), status });
	});

	app.get("/server/history", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			res.set("Cache-Control", "no-store");
			const history = getHistory(String(req.query.range ?? "24h"));
			if (access.role === "viewer") {
				res.json(redactHistory(history, buildAliases(await collectServerStats())));
				return;
			}
			res.json(history);
		} catch (error) {
			console.error("Error reading history:", error);
			res.status(500).json({ error: "Failed to read history" });
		}
	});

	app.get("/server/backups", async (req, res) => {
		const access = await serverAccess(req);

		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		res.set("Cache-Control", "no-store");
		const status = getBackupStatus();
		const drill = getDrillStatus();

		// Viewers see whether backups are healthy, never what is in them
		if (access.role === "viewer") {
			const latest = status.backups[0];
			res.json({
				viewOnly: true,
				health: status.health,
				running: status.running ? { phase: "Backing up", files: null } : null,
				backups: latest
					? [{ startedAt: latest.startedAt, zipBytes: latest.zipBytes, fileCount: latest.fileCount, valid: latest.valid, trigger: latest.trigger }]
					: [],
				latestSources: [],
				nextScheduled: status.nextScheduled,
				postponesNext: false,
				keep: status.keep,
				drill: viewerDrill(drill),
			});
			return;
		}

		// Before the first backup there is no manifest, so the plan stands in
		if (status.latestSources.length === 0) {
			try {
				status.latestSources = (await planBackup()).sources;
				status.sourcesArePlanned = true;
			} catch {}
		}

		res.json({ ...status, drill });
	});

	// Viewers get progress but no file names, commands or log
	function viewerDrill(drill) {
		return {
			running: drill.running && {
				startedAt: drill.running.startedAt,
				phase: drill.running.phase,
				cancelled: drill.running.cancelled,
				phases: drill.running.phases.map(({ current, ...phase }) => phase),
			},
			last: drill.last && {
				ok: drill.last.ok,
				cancelled: drill.last.cancelled ?? false,
				startedAt: drill.last.startedAt,
				finishedAt: drill.last.finishedAt,
				durationMs: drill.last.durationMs,
			},
			lastCompleted: drill.lastCompleted && {
				ok: drill.lastCompleted.ok,
				startedAt: drill.lastCompleted.startedAt,
				finishedAt: drill.lastCompleted.finishedAt,
				durationMs: drill.lastCompleted.durationMs,
			},
			nextScheduled: drill.nextScheduled,
			everyDays: drill.everyDays,
		};
	}

	app.get("/server/drill", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		res.set("Cache-Control", "no-store");
		const drill = getDrillStatus();
		res.json(access.role === "viewer" ? viewerDrill(drill) : drill);
	});

	app.post("/server/drill/cancel", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			cancelDrill();
			res.json(getDrillStatus());
		} catch (error) {
			res.status(409).json({ error: error.message });
		}
	});

	app.post("/server/drill/run", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			const job = startDrill("manual");
			job.then(() => checkNow({ fresh: true })).catch(() => checkNow({ fresh: true }));
			res.json(getDrillStatus());
		} catch (error) {
			res.status(409).json({ error: error.message });
		}
	});

	app.get("/server/backups/drives", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.set("Cache-Control", "no-store");
			res.json({ drives: await listBackupDrives() });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	app.put("/server/backups/drive", express.json(), async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		if (drillRunning()) {
			res.status(409).json({ error: "A restore drill is running, change the drive once it finishes" });
			return;
		}
		try {
			const drive = await setBackupDrive(String(req.body?.mount ?? ""));
			console.log(`Backups now go to ${drive.dir}`);
			checkNow({ fresh: true }).catch(() => {});
			res.json({ drive, status: { ...getBackupStatus(), drill: getDrillStatus() } });
		} catch (error) {
			res.status(409).json({ error: error.message });
		}
	});

	// Plugs come from the lights tool, viewers get their names but not their addresses
	app.get("/server/recovery", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		let plugs = [];
		let plugsError = null;
		try {
			plugs = await listPlugs();
		} catch (error) {
			plugsError = `Could not reach the lights tool: ${error.message}`;
		}
		res.set("Cache-Control", "no-store");
		res.json({
			settings: getRecoverySettings(),
			plugs: access.role === "viewer" ? plugs.map(({ ip, ...plug }) => plug) : plugs,
			plugsError: access.role === "viewer" ? null : plugsError,
			status: getRecoveryStatus(),
			limits: RECOVERY_LIMITS,
		});
	});

	// Answers first, since a dashboard opened through the tunnel loses its connection while cloudflared restarts
	app.post("/server/cloudflared/restart", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		console.log("cloudflared restart requested from /server");
		res.json({ ok: true });
		setTimeout(() => {
			try {
				restartCloudflared();
			} catch (error) {
				console.log(`cloudflared restart failed: ${error?.message}`);
			}
		}, 500);
	});

	app.get("/server/healing", async (req, res) => {
		if (!(await serverAccess(req))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		res.set("Cache-Control", "no-store");
		res.json(getHealingStatus());
	});

	// Reading every plug takes a few seconds each, so the request gets longer
	app.post("/server/energy/sync", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.json(await lightsApi("/energy/sync", { method: "POST" }, 2 * 60 * 1000));
		} catch (error) {
			res.status(502).json({ error: `Could not reach the lights tool: ${error.message}` });
		}
	});

	// Logged by the lights tool from the plugs' own meters
	app.get("/server/energy", async (req, res) => {
		if (!(await serverAccess(req))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		const range = ["1d", "7d", "30d", "1y"].includes(req.query.range) ? req.query.range : "1d";
		try {
			res.set("Cache-Control", "no-store");
			res.json(await lightsApi(`/energy?range=${range}`));
		} catch (error) {
			res.status(502).json({ error: `Could not reach the lights tool: ${error.message}` });
		}
	});

	app.put("/server/recovery", express.json(), async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		const settings = parseRecoverySettings(req.body);
		if (typeof settings === "string") {
			res.status(400).json({ error: settings });
			return;
		}
		saveRecoverySettings(settings);
		res.json({ settings, status: getRecoveryStatus() });
	});

	// Answers first, since the reboot takes this process down with it. pm2's list is saved so every app comes back
	app.post("/server/reboot", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		console.log("Server reboot requested from /server");
		res.json({ ok: true });
		setTimeout(() => {
			try {
				execSync("pm2 save", { stdio: "ignore", timeout: 20000 });
			} catch {}
			try {
				sudoExecSync("systemctl reboot");
			} catch (error) {
				console.log(`Reboot failed: ${error?.message}`);
			}
		}, 1500);
	});

	// Answers straight away, the page polls
	app.post("/server/backups/run", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			const job = startBackup("manual");
			job.then(() => checkNow({ fresh: true })).catch(() => checkNow({ fresh: true }));
			res.json(getBackupStatus());
		} catch (error) {
			res.status(409).json({ error: error.message });
		}
	});

	app.post("/server/containers/:name/restart", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			const restarted = await restartContainer(req.params.name);
			console.log(`Restarted containers from the dashboard: ${restarted.join(", ")}`);
			res.json({ restarted });
		} catch (error) {
			res.status(error.message.startsWith("Unknown") ? 404 : 500).json({ error: error.message });
		}
	});

	app.post("/server/services/:name/restart", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		// Restarting itself would cut the reply off, so it answers first
		if (process.env.name && req.params.name === process.env.name) {
			res.json({ restarted: [req.params.name], self: true });
			setTimeout(() => {
				restartService(req.params.name).catch((error) => console.error("Self restart failed:", error));
			}, 500);
			return;
		}
		try {
			const name = await restartService(req.params.name);
			console.log(`Restarted pm2 service from the dashboard: ${name}`);
			res.json({ restarted: [name] });
		} catch (error) {
			res.status(error.message.startsWith("Unknown") ? 404 : 500).json({ error: error.message });
		}
	});

	app.post("/server/vpn/profiles", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			const name = await createProfile(req.body?.name, req.body?.tunnel === "full" ? "full" : "lan");
			forgetVpn();
			res.json({ created: name, vpn: await getVpn() });
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	});

	app.post("/server/vpn/profiles/:id/qr", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		res.set("Cache-Control", "no-store");

		qrFailures = qrFailures.filter((time) => Date.now() - time < QR_LOCKOUT);
		if (qrFailures.length >= QR_MAX_FAILURES) {
			const minutes = Math.ceil((qrFailures[0] + QR_LOCKOUT - Date.now()) / 60000);
			res.status(429).json({ error: `Too many wrong passwords, try again in ${minutes} min` });
			return;
		}

		if (!serverPasswordMatches(req.body?.password)) {
			qrFailures.push(Date.now());
			const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
			console.log(`Wrong server password for a VPN QR code from ${ip}`);
			sendBotNotification({
				title: "VPN QR code refused",
				body: `A wrong server password was entered for a VPN QR code from ${ip}. ${QR_MAX_FAILURES - qrFailures.length} attempts left before a 15 minute lockout.`,
			});
			res.status(403).json({ error: "Wrong password" });
			return;
		}

		qrFailures = [];

		try {
			const { name, svg } = await getProfileQr(req.params.id);
			console.log(`Showed the VPN QR code for ${name}`);
			res.json({ name, svg });
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	});

	app.delete("/server/vpn/profiles/:id", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			const name = await removeProfile(req.params.id);
			forgetVpn();
			res.json({ removed: name, vpn: await getVpn() });
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	});

	app.get(["/portfolio", "/portfolio/*"], (_, res) => {
		res.redirect("https://xtrendence.dev");
	});

	app.get("/error/:code", (req, res) => {
		const code = req.params.code;

		let message = "Unknown error";
		let status = "Unknown status";
		switch (code) {
			case "401":
				message =
					"It clicks the back button on its link or else it gets the 401 again.";
				status = "Unauthorized";
				break;
			case "404":
				message =
					"Weary traveler, you seem to have lost your way. This page does not exist.";
				status = "Not Found";
				break;
		}

		res.render("pages/error", { code, message, status });
	});

	app.get("/privacy/mobile", (_, res) => {
		res.send(
			"This app does not collect any personal data. All data is stored locally on your device.",
		);
	});

	challenges.map((challenge) => {
		app.get(`/.well-known/acme-challenge/${challenge.url}`, (_, res) => {
			res.send(challenge.data);
		});
	});

	app.get("*", (_, res) => {
		res
			.status(404)
			.send(
				'<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/404"></head></html>',
			);
	});

	app.use((_, res) => {
		res
			.status(401)
			.send(
				'<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>',
			);

		res
			.status(404)
			.send(
				'<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/404"></head></html>',
			);
	});
}
