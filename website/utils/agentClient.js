import net from "node:net";

// The agent does everything privileged for the website, the web process asks it over this socket
// Its folder is xtrendence:apps 0750, so only the owner and the web process can connect
export const AGENT_SOCKET = "/run/xtrendence-agent/agent.sock";

// One request per connection, answered with one line of JSON. Errors keep the HTTP status the agent chose
export function agent(method, args = {}, timeout = 30000) {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection(AGENT_SOCKET);
		let buffer = "";
		let settled = false;

		const finish = (error, result) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			if (error) reject(error);
			else resolve(result);
		};

		socket.setEncoding("utf-8");
		socket.setTimeout(timeout, () => finish(Object.assign(new Error(`The agent did not answer ${method} in time`), { status: 504 })));
		socket.on("connect", () => socket.write(`${JSON.stringify({ method, args })}\n`));
		socket.on("data", (chunk) => {
			buffer += chunk;
			const end = buffer.indexOf("\n");
			if (end === -1) return;
			let reply;
			try {
				reply = JSON.parse(buffer.slice(0, end));
			} catch {
				finish(Object.assign(new Error("The agent sent an unreadable answer"), { status: 502 }));
				return;
			}
			if (reply.error) {
				finish(Object.assign(new Error(reply.error.message), { status: reply.error.status ?? 500 }));
				return;
			}
			finish(null, reply.result ?? null);
		});
		socket.on("end", () => finish(Object.assign(new Error(`The agent closed the connection during ${method}`), { status: 502 })));
		socket.on("error", (error) => finish(Object.assign(new Error(`Could not reach the agent: ${error.code ?? error.message}`), { status: 502 })));
	});
}
