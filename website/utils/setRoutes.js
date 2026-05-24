import express from "express";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode-svg";
import { logout, sudoExecSync, verifyToken } from "./utils.js";

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
