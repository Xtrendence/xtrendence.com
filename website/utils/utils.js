import axios from "axios";
import gradient from "gradient-string";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
