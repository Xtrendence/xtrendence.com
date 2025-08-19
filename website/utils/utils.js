import axios from "axios";
import gradient from "gradient-string";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const autoPath = path.join(__dirname, "../certs/auto");
export const autoCertsPath = `${autoPath}/production/xtrendence.com--and--www.xtrendence.com`;

export function verifyToken(token) {
	return new Promise((resolve, _) => {
		if (!token) {
			resolve(false);
			return;
		}

		axios
			.post("http://localhost:3002/verify", {
				token,
			})
			.then((response) => {
				if (response?.data?.valid === true) {
					resolve(true);
					return;
				}

				resolve(false);
				return;
			})
			.catch((error) => {
				console.log(error);
				resolve(false);
				return;
			});
	});
}

export function logout(token) {
	return new Promise((resolve, _) => {
		if (!token) {
			resolve(false);
			return;
		}

		axios
			.post("http://localhost:3002/logout", {
				token,
			})
			.then((response) => {
				if (response?.data?.success === true) {
					resolve(true);
					return;
				}

				resolve(false);
				return;
			})
			.catch((error) => {
				console.log(error);
				resolve(false);
				return;
			});
	});
}

export function serverOutput(port) {
	console.log(
		gradient("pink", "hotPink")("----------------------------------------"),
	);

	console.log(gradient("pink", "hotPink")(`Server listening on port ${port}`));

	console.log(
		gradient("pink", "hotPink")("----------------------------------------"),
	);

	console.log("Shortcuts:");
	console.log(gradient("lightBlue", "turquoise")("http://xtrendence.com"));
	console.log(gradient("lightBlue", "turquoise")(`http://localhost:${port}`));
	console.log(
		gradient("lightBlue", "turquoise")(`http://192.168.1.50:${port}`),
	);
	console.log(
		gradient("lightBlue", "turquoise")(`http://192.168.1.75:${port}`),
	);
	console.log(
		gradient("lightBlue", "turquoise")(`http://192.168.1.95:${port}`),
	);
}

export function sendBotNotification(notification) {
	const botKey = process.env.BOT_KEY;
	const url = `https://xtrendence.com/bot/fcm/${botKey}?title=${notification.title}&body=${notification.body}`;

	fetch(url, {
		method: "GET",
	})
		.then((text) => {
			return text.text();
		})
		.then((response) => {
			console.log(response);
		})
		.catch((error) => {
			console.log(error);
		});
}

export function sudoExecSync(command) {
	const serverPassword = Buffer.from(
		process.env.SERVER_PASSWORD ?? "",
		"base64",
	).toString("utf-8");

	return execSync(`echo ${serverPassword} | sudo -S ${command}`, {
		encoding: "utf-8",
	});
}
