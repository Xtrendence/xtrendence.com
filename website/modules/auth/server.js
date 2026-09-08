import express from "express";
import * as path from "path";
import { fileURLToPath } from "url";
import { stringifyCircular, getBody } from "./utils/utils.js";
import { existsSync, mkdirSync } from "fs";
import { checkAccount, getAccount, validAccount } from "./utils/account.js";
import {
	checkSessions,
	createSession,
	getSessionQRCode,
	removeSession,
	validSession,
} from "./utils/sessions.js";
import bodyParser from "body-parser";
import axios from "axios";
import gradient from "gradient-string";
import {
	checkRateLimit,
	clearRateLimit,
	getClientKey,
	recordFailure,
} from "./utils/rateLimit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const db = path.join(__dirname, "./db");

if (!existsSync(db)) {
	mkdirSync(db);
}

checkAccount();
checkSessions();

app.use(bodyParser.json());

app.get("/", async (req, res) => {
	const devMode = req.headers["dev-mode"] === "true";

	const authRequest = {
		local: {
			localAddress: req.headers["local-address"],
			remoteAddress: req.headers["remote-address"],
			localRequest:
				req.headers["local-address"] === req.headers["remote-address"],
		},
		environment: {
			devMode: req.headers["dev-mode"],
		},
		connection: req.socket,
		request: req,
		headers: req.headers,
	};

	res.write(
		devMode ? stringifyCircular(authRequest, 4) : "Disabled in production.",
	);
	res.end();
});

app.post("/", async (req, res) => {
	const clientKey = getClientKey(req);
	const retryAfter = checkRateLimit(clientKey);

	if (retryAfter !== null) {
		console.log(
			gradient("orange", "red")(`Rate limited login attempt: ${clientKey}`),
		);

		res.set("Retry-After", String(retryAfter));

		res.status(429).json({
			error: "Too many login attempts. Please try again later.",
		});

		return;
	}

	try {
		const body = await getBody(req);

		const { username, password } = body;

		if (!username || !password) {
			res.status(400).json({
				error: "Missing required parameters.",
			});

			return;
		}

		if (!validAccount(username, password)) {
			recordFailure(clientKey);

			res.status(401).json({
				error: "Invalid credentials.",
			});

			return;
		}

		// Credentials proved, so the failure budget for this client resets.
		clearRateLimit(clientKey);

		console.log(gradient("khaki", "yellow")(`Logged in as ${username}`));

		const token = createSession();

		const notification = {
			title: Buffer.from(encodeURIComponent(`🔑 New Login 🔑`)).toString(
				"base64",
			),
			body: Buffer.from(
				encodeURIComponent(
					`${req.headers["remote-address"]} logged in as ${username}`,
				),
			).toString("base64"),
		};

		const domain =
			req.headers["dev-mode"] === "true"
				? "http://localhost:3000"
				: "https://xtrendence.com";

		const url = `${domain}/bot/fcm/${token}?title=${notification.title}&body=${notification.body}`;

		axios.get(url).catch((error) => {
			console.log(error);
		});

		// sameSite: "lax" is the CSRF fix — it stops the cookie riding along on
		// cross-site form posts and subresource loads, so another site can no
		// longer drive the authenticated tool endpoints in the background. Top
		// level navigations still send it, so following a link into the site
		// keeps working.
		//
		// secure is deliberately not set: direct.xtrendence.com is served over
		// plain HTTP, and the flag would stop the cookie being set there.
		// httpOnly is deliberately not set: public/assets/js/auth.js reads
		// document.cookie to decide whether to keep the localStorage token, and
		// would clear it on every page load.
		res.cookie("token", token, {
			maxAge: 1000 * 60 * 60 * 24 * 30 * 6,
			sameSite: "lax",
		});

		return res.status(200).json({
			token,
		});
	} catch (error) {
		console.log(error);
		res.status(500).send("Internal server error.");
	}
});

app.post("/verify", async (req, res) => {
	try {
		const body = await getBody(req);

		const { token } = body;

		if (!token) {
			res.status(400).json({
				error: "Missing required parameters.",
			});

			return;
		}

		if (!validSession(token)) {
			res.status(401).json({
				error: "Invalid session token.",
			});

			return;
		}

		const account = getAccount();

		console.log(
			gradient("khaki", "yellow")(`Logged in as ${account.username}`),
		);

		return res.status(200).json({
			valid: true,
			username: account.username,
		});
	} catch (error) {
		console.log(error);
		res.status(500).send("Internal server error.");
	}
});

app.get("/qr/:token/:format", async (req, res) => {
	try {
		const { token, format } = req.params;

		if (!token) {
			res.status(400).json({
				error: "Missing required parameters.",
			});

			return;
		}

		if (!["svg", "base64"].includes(format)) {
			res.status(400).json({
				error: "Format must be svg or base64.",
			});
		}

		const qrcode = getSessionQRCode(token, req.headers["dev-mode"] === "true");

		if (!qrcode) {
			res.status(401).json({
				error: "Invalid session token.",
			});

			return;
		}

		let svg = qrcode.svg();

		if (format === "base64") {
			svg = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
		}

		res.send(svg);
	} catch (error) {
		console.log(error);
		res.status(500).send("Internal server error.");
	}
});

app.post("/logout", async (req, res) => {
	try {
		const body = await getBody(req);

		const { token } = body;

		if (!token) {
			res.status(400).json({
				error: "Missing required parameters.",
			});

			return;
		}

		if (!validSession(token)) {
			res.status(401).json({
				error: "Invalid session token.",
			});

			return;
		}

		removeSession(token);

		return res.status(200).json({
			success: true,
		});
	} catch (error) {
		console.log(error);
		res.status(500).send("Internal server error.");
	}
});

app.listen(3002, () => {
	console.log(
		gradient(
			"lightPink",
			"pink",
			"violet",
		)("Auth server listening on port 3002"),
	);
});
