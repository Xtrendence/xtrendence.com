import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addRoutes } from "./lights";
import { verifyToken } from "./utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
	path: path.join(__dirname, ".env"),
});

const email = process.env.TP_EMAIL;
const password = process.env.TP_PASSWORD;
const devMode = process.env.DEV_MODE === "true";

if (!email || !password) {
	throw new Error("TP_EMAIL and TP_PASSWORD must be set in .env file");
}

const kasaInstalled = execSync("which kasa").toString().trim();
console.log("Kasa CLI Path: ", kasaInstalled);
if (!kasaInstalled?.includes("kasa")) {
	throw new Error("Kasa CLI is not installed. Run 'pip install python-kasa'");
}

const app = express();

const indexFile = path.join(__dirname, "../dist/index.html");

app.use(express.static(path.join(__dirname, "../dist")));
app.use(cors());
app.use(cookieParser());

app.use(async (req, res, next) => {
	if (devMode) {
		return next();
	}

	const keysJson = readFileSync(path.join(__dirname, "keys.txt"), "utf-8");
	const keys = keysJson ? JSON.parse(keysJson || "[]") : [];

	const token = req.cookies.token;
	const key = req.headers.key;

	const verified = key ? keys.includes(key) : await verifyToken(token);

	if (!verified && !keys.includes(key)) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	return next();
});

app.get("/", (_, res) => {
	res.sendFile(indexFile);
});

addRoutes(app, email, password);

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
	console.log("Server Mode: ", devMode ? "Development" : "Production");
	console.log("TP-Link Email: ", email);
	console.log(`Server is running on http://localhost:${PORT}`);
});
