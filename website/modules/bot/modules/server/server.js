import axios from "axios";

// Asks the website for a view-only share code as the logged in user, so the
// bot needs no key of its own and a logged out app cannot get one
export async function shareServer({ token } = {}) {
	if (!token) {
		return "You need to be logged in to share the server dashboard.";
	}

	try {
		const { data } = await axios.post(
			"http://localhost:80/server/share",
			{},
			{ headers: { Cookie: `token=${token}` }, timeout: 10000 },
		);
		const until = new Date(data.expiresAt).toLocaleTimeString("en-GB", {
			hour: "2-digit",
			minute: "2-digit",
		});
		return `Share code ${data.pin}, view only until ${until}.\n${data.url}`;
	} catch (error) {
		if (error?.response?.status === 401) {
			return "The website did not accept your login, so no share code was made.";
		}
		return "I could not reach the website to make a share code.";
	}
}

export async function serverAddress() {
	const ipv4 = await axios.get("https://api.ipify.org?format=json");
	const ipv6 = await axios.get("https://api64.ipify.org?format=json");
	return `IPv4: ${ipv4.data.ip}, IPv6: ${ipv6.data.ip}`;
}
