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
			// A 401 from the auth service is the normal answer for an invalid token, not a
			// fault, so it is logged as one line. Gated routes verify every request, which
			// includes each static asset, so dumping the whole error object here buried the
			// logs the moment a signed out visitor loaded a page.
			.catch((error) => {
				console.log(`Token verification failed: ${error?.message}`);
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

// Goes straight to the bot on localhost so alerts still arrive when the public
// site is down. Title and body are sent as base64 of the URI encoded text,
// which the bot passes through untouched, so any character survives
export function sendBotNotification(notification) {
	const botKey = process.env.BOT_KEY;
	const encode = (text) =>
		encodeURIComponent(
			Buffer.from(encodeURIComponent(String(text ?? ""))).toString("base64"),
		);
	const url = `http://localhost:3004/fcm/${botKey}?title=${encode(notification.title)}&body=${encode(notification.body)}`;

	return fetch(url, {
		method: "GET",
		redirect: "manual",
	})
		.then(async (response) => {
			const text = await response.text();
			console.log(text);
			return response.ok;
		})
		.catch((error) => {
			console.log(error);
			return false;
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
