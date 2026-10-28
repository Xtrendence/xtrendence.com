import { CHUNK_BYTES, type TResponse } from "../../shared/protocol";
import { bytes, decoder, encoder, exchange, fingerprint, type SealKey } from "./crypto";

// Sealed requests only, and the server's key is pinned on first visit so a changed key shows a warning

const PIN_KEY = "vault-server-key";

export class KeyChanged extends Error {
	constructor(
		readonly pinned: string,
		readonly offered: string,
		readonly pub: string,
	) {
		super("The server's key changed");
	}
}

function readPin() {
	try {
		return localStorage.getItem(PIN_KEY);
	} catch {
		return null;
	}
}

export function pinKey(pub: string) {
	try {
		localStorage.setItem(PIN_KEY, pub);
	} catch {}
}

export class VaultClient {
	private key: SealKey | null = null;
	private session = "";
	private n = 0;
	private connecting: Promise<void> | null = null;
	fingerprint = "";

	connect() {
		this.connecting ??= this.open().finally(() => {
			this.connecting = null;
		});
		return this.connecting;
	}

	private async open() {
		const { pub } = (await (await fetch("/api/key", { cache: "no-store" })).json()) as { pub: string };
		const pinned = readPin();
		if (pinned && pinned !== pub) {
			throw new KeyChanged(fingerprint(pinned), fingerprint(pub), pub);
		}
		if (!pinned) {
			pinKey(pub);
		}
		this.fingerprint = fingerprint(pub);
		const { key, pub: mine } = await exchange(pub);
		const response = await fetch("/api/session", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ pub: mine }),
		});
		if (!response.ok) {
			throw new Error("The server refused the session");
		}
		this.session = ((await response.json()) as { id: string }).id;
		this.key = key;
	}

	// Sends one sealed request, reconnecting once if the server forgot the session after a restart
	private async send(
		endpoint: string,
		method: string,
		params: Record<string, unknown>,
		retry = true,
	): Promise<{ key: SealKey; n: number; sealed: Uint8Array }> {
		if (!this.key) {
			await this.connect();
		}
		const key = this.key as SealKey;
		const n = ++this.n;
		const body = await key.seal("c>s", encoder.encode(JSON.stringify({ n, m: method, p: params })));
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/octet-stream", "X-Session": this.session },
			body: bytes(body),
		});
		if (response.status === 401 && retry) {
			this.key = null;
			await this.connect();
			return this.send(endpoint, method, params, false);
		}
		if (!response.ok) {
			throw new Error(response.status === 403 ? "Locked" : `Request failed (${response.status})`);
		}
		return { key, n, sealed: new Uint8Array(await response.arrayBuffer()) };
	}

	async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
		const { key, n, sealed } = await this.send("/api/rpc", method, params);
		const plain = await key.open(`s>c:${n}`, sealed);
		if (!plain) {
			throw new Error("A response failed its integrity check");
		}
		const response = JSON.parse(decoder.decode(plain)) as TResponse;
		if (response.n !== n) {
			throw new Error("A response failed its integrity check");
		}
		if (!response.ok) {
			throw new Error(response.e);
		}
		return response.r as T;
	}

	async readChunk(path: string, offset: number, length: number) {
		const { key, n, sealed } = await this.send("/api/read", "read", { path, offset, length });
		const plain = await key.open(`s>c:${n}:data`, sealed);
		if (!plain) {
			throw new Error("A file part failed its integrity check");
		}
		return plain;
	}

	// The whole file in memory, a few parts in flight at once
	async download(path: string, size: number, onProgress: (done: number) => void, signal: AbortSignal) {
		const count = Math.max(1, Math.ceil(size / CHUNK_BYTES));
		const parts: Uint8Array[] = new Array(count);
		let next = 0;
		let done = 0;
		const lane = async () => {
			while (next < count) {
				if (signal.aborted) {
					throw new DOMException("Cancelled", "AbortError");
				}
				const index = next++;
				parts[index] = await this.readChunk(path, index * CHUNK_BYTES, CHUNK_BYTES);
				done += parts[index].length;
				onProgress(done);
			}
		};
		await Promise.all([lane(), lane(), lane()]);
		return new Blob(parts.map(bytes));
	}
}
