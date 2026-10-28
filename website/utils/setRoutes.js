import express from "express";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode-svg";
import { agent } from "./agentClient.js";
import {
	VIEW_COOKIE,
	activeShareCodes,
	createShareCode,
	redeemPin,
	stopSharing,
	viewSession,
} from "./serverShare.js";
import { logout, verifyToken } from "./utils.js";
import {
	buildAliases,
	redactHistory,
	redactRules,
	redactStats,
} from "./viewRedaction.js";

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


// Privileged work happens in the agent, an agent error carries the status to answer with
function agentFailed(res, error, fallback = 500) {
	res.status(error.status ?? fallback).json({ error: error.message });
}

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
	// launcher.xtrendence.com is a short entry point, the page lives on the main host where the login cookie is valid
	app.use((req, res, next) => {
		if (req.hostname === "launcher.xtrendence.com") {
			res.redirect(302, "https://www.xtrendence.com/launcher");
			return;
		}
		next();
	});

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
			await agent("dockerIpv6", {}, 10 * 60 * 1000);
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

	app.get("/launcher", async (req, res) => {
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

		// The page still renders without the toggle if the script or the agent is missing
		const theme = await agent("theme", { action: "status" }).catch(() => null);

		res.set("Cache-Control", "no-store");
		res.render("pages/launcher", { theme });
	});

	app.post("/launcher/theme", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		if (typeof req.body?.on !== "boolean") {
			res.status(400).json({ error: "Expected { on: boolean }" });
			return;
		}

		try {
			res.set("Cache-Control", "no-store");
			res.json(await agent("theme", { action: req.body.on ? "on" : "off" }));
		} catch (error) {
			console.error("Error switching the theme:", error.message);
			res.status(500).json({ error: "Could not switch the theme" });
		}
	});

	app.get("/server", async (req, res) => {
		// Swaps the PIN for a session cookie and drops it from the URL
		if (req.query.pin !== undefined) {
			const result = redeemPin(String(req.query.pin), clientIp(req));
			if (result.error) {
				res
					.status(403)
					.render("pages/error", {
						code: "403",
						message: result.error,
						status: "Forbidden",
					});
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
		console.log(
			`Created a server share code, expires ${new Date(code.expiresAt).toISOString()}`,
		);
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
			const stats = await agent("stats");
			res.set("Cache-Control", "no-store");
			res.json(
				access.role === "viewer"
					? redactStats(stats, buildAliases(stats))
					: stats,
			);
		} catch (error) {
			console.error("Error collecting server stats:", error.message);
			res.status(500).json({ error: "Failed to collect server stats" });
		}
	});

	app.get("/server/timeline", async (req, res) => {
		if (!(await serverAccess(req))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.set("Cache-Control", "no-store");
			res.json(
				await agent("timeline", { range: String(req.query.range ?? "24h") }),
			);
		} catch (error) {
			agentFailed(res, error);
		}
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
			const snapshot = await agent("snapshot", { t: time });
			if (!snapshot) {
				res.status(404).json({ error: "No snapshots recorded yet" });
				return;
			}
			res.set("Cache-Control", "no-store");
			const stats =
				access.role === "viewer"
					? redactStats(snapshot.stats, buildAliases(snapshot.stats))
					: snapshot.stats;
			res.json({ t: snapshot.t, stats });
		} catch (error) {
			if (error.status === 400) {
				res.status(400).json({ error: error.message });
				return;
			}
			console.error("Error reading snapshot:", error.message);
			res.status(500).json({ error: "Failed to read snapshot" });
		}
	});

	app.get("/server/alerts", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			res.set("Cache-Control", "no-store");
			const payload = await agent("alerts");
			if (access.role === "viewer") {
				res.json(
					redactRules(
						payload,
						buildAliases(await agent("stats"), payload.choices.mounts),
					),
				);
				return;
			}
			res.json(payload);
		} catch (error) {
			agentFailed(res, error);
		}
	});

	// Saving runs a check straight away so the light reflects the new rules
	app.put("/server/alerts", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			res.json(await agent("saveAlertRules", { rules: req.body?.rules }));
		} catch (error) {
			agentFailed(res, error);
		}
	});

	app.post("/server/alerts/check", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			res.json(await agent("checkAlerts"));
		} catch (error) {
			agentFailed(res, error);
		}
	});

	app.post("/server/alerts/notify", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			const result = await agent("notifyAlerts");
			if (!result.sent) {
				res
					.status(502)
					.json({ error: "The bot did not accept the notification" });
				return;
			}
			res.json({ sent: true, status: result.status });
		} catch (error) {
			agentFailed(res, error);
		}
	});

	// Rechecks after, so the page and light catch up
	app.post("/server/vpn/restart", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			res.json(await agent("restartVpn", {}, 3 * 60 * 1000));
		} catch (error) {
			agentFailed(res, error);
		}
	});

	app.get("/server/vpn/exit", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.set("Cache-Control", "no-store");
			res.json(
				await agent("vpnExit", { statusOnly: req.query.status === "1" }),
			);
		} catch (error) {
			agentFailed(res, error);
		}
	});

	app.post("/server/vpn/exit", express.json(), async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.json(
				await agent("startVpnSwitch", { suffix: String(req.body?.suffix ?? "") }),
			);
		} catch (error) {
			agentFailed(res, error, 409);
		}
	});

	app.get("/server/history", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			res.set("Cache-Control", "no-store");
			const history = await agent("history", {
				range: String(req.query.range ?? "24h"),
			});
			if (access.role === "viewer") {
				res.json(redactHistory(history, buildAliases(await agent("stats"))));
				return;
			}
			res.json(history);
		} catch (error) {
			console.error("Error reading history:", error.message);
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
		// The agent fills in the planned sources before the first backup, for the owner only
		let status;
		try {
			status = await agent("backups", { plan: access.role === "owner" });
		} catch (error) {
			agentFailed(res, error);
			return;
		}
		const { drill } = status;

		// Viewers see whether backups are healthy, never what is in them
		if (access.role === "viewer") {
			const latest = status.backups[0];
			res.json({
				viewOnly: true,
				health: status.health,
				running: status.running ? { phase: "Backing up", files: null } : null,
				backups: latest
					? [
							{
								startedAt: latest.startedAt,
								zipBytes: latest.zipBytes,
								fileCount: latest.fileCount,
								valid: latest.valid,
								trigger: latest.trigger,
							},
						]
					: [],
				latestSources: [],
				nextScheduled: status.nextScheduled,
				postponesNext: false,
				keep: status.keep,
				drill: viewerDrill(drill),
				vaultMirror: viewerMirror(status.vaultMirror),
			});
			return;
		}

		res.json(status);
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

	// Viewers see whether the vault mirror works and how far a sync is, never paths, counts or errors
	function viewerMirror(mirror) {
		const brief = (result) => result && { ok: result.ok, startedAt: result.startedAt, finishedAt: result.finishedAt, held: Boolean(result.held) };
		return mirror && {
			running: mirror.running && {
				startedAt: mirror.running.startedAt,
				phase: mirror.running.phase,
				progress: mirror.running.progress && { percent: mirror.running.progress.percent },
			},
			lastCompleted: brief(mirror.lastCompleted),
			lastSuccess: brief(mirror.lastSuccess),
			held: mirror.held && {},
			nextScheduled: mirror.nextScheduled,
			everyHours: mirror.everyHours,
		};
	}

	app.get("/server/vault-mirror", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.set("Cache-Control", "no-store");
			const mirror = await agent("vaultMirror");
			res.json(access.role === "viewer" ? viewerMirror(mirror) : mirror);
		} catch (error) {
			agentFailed(res, error);
		}
	});

	app.post("/server/vault-mirror/run", express.json(), async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		const approve = Number(req.body?.approve);
		try {
			res.json(
				await agent("startVaultMirror", {
					approve: Number.isInteger(approve) && approve > 0 ? approve : null,
					checksum: req.body?.checksum === true,
				}),
			);
		} catch (error) {
			agentFailed(res, error, 409);
		}
	});

	app.post("/server/vault-mirror/cancel", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.json(await agent("cancelVaultMirror"));
		} catch (error) {
			agentFailed(res, error, 409);
		}
	});

	app.get("/server/drill", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.set("Cache-Control", "no-store");
			const drill = await agent("drill");
			res.json(access.role === "viewer" ? viewerDrill(drill) : drill);
		} catch (error) {
			agentFailed(res, error);
		}
	});

	app.post("/server/drill/cancel", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.json(await agent("cancelDrill"));
		} catch (error) {
			agentFailed(res, error, 409);
		}
	});

	app.post("/server/drill/run", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			res.json(await agent("startDrill"));
		} catch (error) {
			agentFailed(res, error, 409);
		}
	});

	app.get("/server/backups/drives", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.set("Cache-Control", "no-store");
			res.json(await agent("backupDrives", {}, 2 * 60 * 1000));
		} catch (error) {
			agentFailed(res, error);
		}
	});

	app.put("/server/backups/drive", express.json(), async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.json(
				await agent(
					"setBackupDrive",
					{ mount: String(req.body?.mount ?? "") },
					2 * 60 * 1000,
				),
			);
		} catch (error) {
			agentFailed(res, error, 409);
		}
	});

	// Plugs come from the lights tool, viewers get their names but not their addresses
	app.get("/server/recovery", async (req, res) => {
		const access = await serverAccess(req);
		if (!access) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		let recovery;
		try {
			recovery = await agent("recovery");
		} catch (error) {
			agentFailed(res, error);
			return;
		}
		res.set("Cache-Control", "no-store");
		res.json({
			...recovery,
			plugs:
				access.role === "viewer"
					? recovery.plugs.map(({ ip, ...plug }) => plug)
					: recovery.plugs,
			plugsError: access.role === "viewer" ? null : recovery.plugsError,
		});
	});

	// Answers first, since a dashboard opened through the tunnel loses its connection while cloudflared restarts
	app.post("/server/cloudflared/restart", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		res.json({ ok: true });
		setTimeout(() => {
			agent("restartCloudflared", {}, 60000).catch((error) =>
				console.log(`cloudflared restart failed: ${error?.message}`),
			);
		}, 500);
	});

	app.get("/server/healing", async (req, res) => {
		if (!(await serverAccess(req))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.set("Cache-Control", "no-store");
			res.json(await agent("healing"));
		} catch (error) {
			agentFailed(res, error);
		}
	});

	// Reading every plug takes a few seconds each, so the request gets longer
	app.post("/server/energy/sync", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.json(await agent("energySync", {}, 3 * 60 * 1000));
		} catch (error) {
			agentFailed(res, error, 502);
		}
	});

	// Logged by the lights tool from the plugs' own meters
	app.get("/server/energy", async (req, res) => {
		if (!(await serverAccess(req))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.set("Cache-Control", "no-store");
			res.json(await agent("energy", { range: String(req.query.range ?? "") }));
		} catch (error) {
			agentFailed(res, error, 502);
		}
	});

	app.put("/server/recovery", express.json(), async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.json(await agent("saveRecovery", { body: req.body ?? {} }));
		} catch (error) {
			agentFailed(res, error);
		}
	});

	// Answers first, since the reboot takes this process down with it. pm2's list is saved so every app comes back
	app.post("/server/reboot", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		res.json({ ok: true });
		setTimeout(() => {
			try {
				execSync("pm2 save", { stdio: "ignore", timeout: 20000 });
			} catch {}
			agent("reboot").catch((error) =>
				console.log(`Reboot failed: ${error?.message}`),
			);
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
			res.json(await agent("startBackup"));
		} catch (error) {
			agentFailed(res, error, 409);
		}
	});

	app.post("/server/containers/:name/restart", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}
		try {
			res.json(
				await agent("restartContainer", { name: req.params.name }, 7 * 60 * 1000),
			);
		} catch (error) {
			agentFailed(res, error);
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
				agent("restartService", { name: req.params.name }, 90000).catch(
					(error) => console.error("Self restart failed:", error.message),
				);
			}, 500);
			return;
		}
		try {
			res.json(
				await agent("restartService", { name: req.params.name }, 90000),
			);
		} catch (error) {
			agentFailed(res, error);
		}
	});

	app.post("/server/vpn/profiles", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			res.json(
				await agent(
					"createProfile",
					{
						name: String(req.body?.name ?? ""),
						tunnel: req.body?.tunnel === "full" ? "full" : "lan",
					},
					2 * 60 * 1000,
				),
			);
		} catch (error) {
			agentFailed(res, error, 400);
		}
	});

	app.post("/server/vpn/profiles/:id/qr", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		res.set("Cache-Control", "no-store");

		// The agent checks the password and keeps the lockout, so neither can be skipped from here
		try {
			res.json(
				await agent(
					"profileQr",
					{
						id: req.params.id,
						password: String(req.body?.password ?? ""),
						ip: String(
							req.headers["x-forwarded-for"] || req.socket.remoteAddress,
						),
					},
					60000,
				),
			);
		} catch (error) {
			agentFailed(res, error, 400);
		}
	});

	app.post("/server/vpn/profiles/:id/conf", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		res.set("Cache-Control", "no-store");

		// The agent checks the password and keeps the lockout, so neither can be skipped from here
		try {
			res.json(
				await agent(
					"profileConf",
					{
						id: req.params.id,
						password: String(req.body?.password ?? ""),
						ip: String(
							req.headers["x-forwarded-for"] || req.socket.remoteAddress,
						),
					},
					60000,
				),
			);
		} catch (error) {
			agentFailed(res, error, 400);
		}
	});

	// The agent checks the current password and keeps the lockout, the helper changes login, SSH and Samba
	app.post("/server/password", async (req, res) => {
		if (!(await verifyToken(req.cookies.token))) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		res.set("Cache-Control", "no-store");
		try {
			res.json(
				await agent(
					"changePassword",
					{
						current: String(req.body?.current ?? ""),
						next: String(req.body?.next ?? ""),
						ip: clientIp(req),
					},
					90000,
				),
			);
		} catch (error) {
			agentFailed(res, error);
		}
	});

	app.delete("/server/vpn/profiles/:id", async (req, res) => {
		const validToken = await verifyToken(req.cookies.token);

		if (!validToken) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		try {
			res.json(
				await agent("removeProfile", { id: req.params.id }, 2 * 60 * 1000),
			);
		} catch (error) {
			agentFailed(res, error, 400);
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
