import axios from "axios";

const port = 3001;
const protocol = window.location.protocol;
const hostname = window.location.hostname;
export const api =
	hostname.includes("xtrendence") ||
	[80, 443].includes(Number(window.location.port))
		? `${protocol}//${hostname}/tools/lights/api`
		: `${protocol}//${hostname}:${port}/api`;

export function authAxios() {
	const token = new URLSearchParams(window.location.search).get("token");
	return axios.create({
		baseURL: api,
		headers: {
			key: token,
		},
	});
}
