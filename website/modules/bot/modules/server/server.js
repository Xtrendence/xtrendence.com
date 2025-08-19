import axios from "axios";

export async function serverAddress() {
	const ipv4 = await axios.get("https://api.ipify.org?format=json");
	const ipv6 = await axios.get("https://api64.ipify.org?format=json");
	return `IPv4: ${ipv4.data.ip}, IPv6: ${ipv6.data.ip}`;
}
