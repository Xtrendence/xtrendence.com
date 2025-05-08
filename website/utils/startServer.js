import fs, { readdirSync } from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import { createServer as createSecureServer } from "node:https";
import AutoEncrypt from "@small-tech/auto-encrypt";
import { setRoutes } from "./setRoutes.js";
import { createProxies } from "./createProxies.js";
import { serverOutput, autoPath, autoCertsPath } from "./utils.js";
import axios from "axios";
import { execSync } from "node:child_process";

export function startServer({ app, dirname, devMode }) {
	createProxies(app, devMode);
	setRoutes(app);

	if (!devMode) {
		const disableAuto = false;

		const certFiles = disableAuto
			? {
					key: path.join(dirname, "certs/privkey.pem"),
					cert: path.join(dirname, "certs/cert.pem"),
					ca: path.join(dirname, "certs/fullchain.pem"),
				}
			: {
					key: `${autoCertsPath}/certificate-identity.pem`,
					cert: `${autoCertsPath}/certificate.pem`,
					ca: `${autoPath}/production/account-identity.pem`,
					account: `${autoPath}/production/account.json`,
				};

		const key = fs.existsSync(certFiles.key)
			? fs.readFileSync(certFiles.key, "utf8")
			: undefined;
		const cert = fs.existsSync(certFiles.cert)
			? fs.readFileSync(certFiles.cert, "utf8")
			: undefined;
		const ca = fs.existsSync(certFiles.ca)
			? fs.readFileSync(certFiles.ca, "utf8")
			: undefined;

		const credentials = {
			key,
			cert,
			ca,
		};

		const sslAvailable = key && cert && ca;

		console.log(credentials);

		if (sslAvailable) {
			app.enable("trust proxy");

			app.use((req, res, next) => {
				if (req.secure) {
					next();
				} else {
					res.redirect(`https://www.xtrendence.com${req.url}`);
				}
			});
		}

		if (!disableAuto) {
			const autoFile = `${autoPath}/renewal.log`;
			if (!fs.existsSync(autoPath)) {
				fs.mkdirSync(autoPath, { recursive: true });
			}

			const files = readdirSync(autoCertsPath);
			let lastRenewal = 0;
			if (fs.existsSync(autoFile)) {
				const stats = fs.statSync(autoFile);
				lastRenewal = stats.mtimeMs;
			}

			const timePassed = Date.now() - lastRenewal;
			const twoMonths = 60 * 24 * 60 * 60 * 1000;

			const twoMonthsPassed = timePassed > twoMonths;
			const requiresRenewal = !files.length || twoMonthsPassed;

			console.log(
				"Time passed (days):",
				Math.floor(timePassed / (1000 * 60 * 60 * 24)),
			);
			console.log("Last renewal:", new Date(lastRenewal).toISOString());
			console.log("Two months passed:", twoMonthsPassed);
			console.log("Requires renewal:", requiresRenewal);

			if (twoMonthsPassed) {
				Object.values(certFiles).map((file) => {
					if (fs.existsSync(file)) {
						fs.unlinkSync(file);
					}
				});
			}

			if (requiresRenewal) {
				AutoEncrypt.https
					.createServer({
						domains: ["xtrendence.com", "www.xtrendence.com"],
						settingsPath: path.join(dirname, "certs/auto"),
					})
					.listen(443);

				fs.writeFileSync(autoFile, `Renewed at ${new Date().toISOString()}`);

				setInterval(async () => {
					await axios.get("https://www.xtrendence.com").catch((err) => {
						console.error(err);
					});

					const files = readdirSync(autoCertsPath);
					if (files.length > 1) {
						console.log("Restarting server...");
						execSync("pm2 restart xtrendence.com");
					}
				}, 5000);

				return;
			}
		}

		const httpServer = createServer(app);
		httpServer.listen(80);

		if (sslAvailable) {
			const httpsServer = createSecureServer(credentials, app);
			httpsServer.listen(443, () => {
				serverOutput(443);
			});
		}
	} else {
		app.listen(3000, () => {
			serverOutput(3000);
		});
	}
}
