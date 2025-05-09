import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { validJSON } from "./utils.js";
import QRCode from "qrcode-svg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = path.join(__dirname, "../db");
const sessions = path.join(db, "sessions.db");

export function getSessions() {
	const content = readFileSync(sessions);
	if (validJSON(content)) {
		return JSON.parse(content);
	}

	resetSessions();

	return [];
}

export function createSession() {
	const token = randomBytes(32).toString("hex");

	// Expires in 6 months.
	const expires = Date.now() + 1000 * 60 * 60 * 24 * 30 * 6;

	const content = getSessions();
	content.push({
		token,
		expires,
	});

	const existingSessions =
		content.filter((session) => !session.token?.includes("keep")) || [];

	// Sessions that have 'keep' in the token are kept indefinitely.
	const keepSessions =
		content.filter((session) => session.token?.includes("keep")) || [];

	// Limit to 20 sessions.
	if (existingSessions.length > 20) {
		existingSessions.shift();
	}

	const newSessions = [...existingSessions, ...keepSessions];

	writeFileSync(sessions, JSON.stringify(newSessions));

	return token;
}

export function validSession(token) {
	const sessions = getSessions();
	for (const session of sessions) {
		const validToken = session.token.includes("keep")
			? session.token.split("-keep")[0]
			: session.token;
		if (
			validToken === token &&
			(session.expires > Date.now() || session.token.includes("keep"))
		) {
			return true;
		}
	}

	return false;
}

export function getSessionQRCode(token, devMode) {
	const valid = validSession(token);

	if (!valid) {
		return null;
	}

	const svg = new QRCode({
		background: "#0000",
		color: "#000",
		content: JSON.stringify({
			token,
			domain: devMode ? "http://192.168.1.75:3000" : "https://xtrendence.com",
		}),
		ecl: "H",
		padding: 0,
	});

	return svg;
}

export function removeSession(token) {
	const content = getSessions();
	for (let i = 0; i < content.length; i++) {
		if (content[i].token === token) {
			content.splice(i, 1);
			break;
		}
	}

	writeFileSync(sessions, JSON.stringify(content));
}

export function resetSessions() {
	writeFileSync(sessions, JSON.stringify([]));
}

export function checkSessions() {
	if (!existsSync(sessions) || !readFileSync(sessions)) {
		resetSessions();
	}
}
