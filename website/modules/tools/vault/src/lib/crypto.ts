import { ctr } from "@noble/ciphers/aes.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

// WebCrypto only exists on secure origins, so plain HTTP on the LAN uses noble
const subtle: SubtleCrypto | undefined = globalThis.isSecureContext ? globalThis.crypto?.subtle : undefined;
export const nativeCrypto = Boolean(subtle);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomBytes(length: number) {
	const out = new Uint8Array(length);
	for (let i = 0; i < length; i += 65536) {
		crypto.getRandomValues(out.subarray(i, i + 65536));
	}
	return out;
}

export function concat(...parts: Uint8Array[]) {
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

export const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export function fromHex(hex: string) {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

export function toBase64(bytes: Uint8Array) {
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}

export function fromBase64(text: string) {
	const binary = atob(text);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		out[i] = binary.charCodeAt(i);
	}
	return out;
}

// Narrows to plain ArrayBuffer backed bytes, which WebCrypto and Blob require
export const bytes = (data: Uint8Array) => data as Uint8Array<ArrayBuffer>;

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
	if (a.length !== b.length) {
		return false;
	}
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a[i] ^ b[i];
	}
	return diff === 0;
}

// AES-256-CTR for secrecy and HMAC-SHA-256 for integrity, encrypt then MAC, the label is part of the MAC
export class SealKey {
	private aes: CryptoKey | null = null;
	private mac: CryptoKey | null = null;

	private constructor(
		private readonly encKey: Uint8Array,
		private readonly macKey: Uint8Array,
	) {}

	static async create(material: Uint8Array) {
		const key = new SealKey(material.slice(0, 32), material.slice(32, 64));
		if (subtle) {
			key.aes = await subtle.importKey("raw", bytes(key.encKey), "AES-CTR", false, ["encrypt", "decrypt"]);
			key.mac = await subtle.importKey("raw", bytes(key.macKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
		}
		return key;
	}

	private async ctr(counter: Uint8Array, data: Uint8Array) {
		if (subtle && this.aes) {
			return new Uint8Array(await subtle.encrypt({ name: "AES-CTR", counter: bytes(counter), length: 32 }, this.aes, bytes(data)));
		}
		return ctr(this.encKey, counter).encrypt(data);
	}

	private async sign(data: Uint8Array) {
		if (subtle && this.mac) {
			return new Uint8Array(await subtle.sign("HMAC", this.mac, bytes(data)));
		}
		return hmac(sha256, this.macKey, data);
	}

	async seal(label: string, data: Uint8Array) {
		const counter = randomBytes(16);
		counter.fill(0, 12);
		const body = await this.ctr(counter, data);
		const tag = await this.sign(concat(encoder.encode(label), counter, body));
		return concat(counter, body, tag);
	}

	async open(label: string, sealed: Uint8Array) {
		if (sealed.length < 48) {
			return null;
		}
		const counter = sealed.subarray(0, 16);
		const body = sealed.subarray(16, sealed.length - 32);
		const tag = sealed.subarray(sealed.length - 32);
		if (!constantTimeEqual(tag, await this.sign(concat(encoder.encode(label), counter, body)))) {
			return null;
		}
		return this.ctr(counter, body);
	}
}

export type TExchange = { key: SealKey; pub: string };

// A fresh key pair per page load, matched against the server's long lived key
export async function exchange(serverPubBase64: string): Promise<TExchange> {
	const serverPub = fromBase64(serverPubBase64);
	if (serverPub.length !== 32) {
		throw new Error("Bad server key");
	}
	const secret = x25519.utils.randomSecretKey();
	const pub = x25519.getPublicKey(secret);
	const shared = x25519.getSharedSecret(secret, serverPub);
	if (shared.every((byte) => byte === 0)) {
		throw new Error("Bad server key");
	}
	const salt = sha256(concat(pub, serverPub));
	const key = await SealKey.create(hkdf(sha256, shared, salt, encoder.encode("vault v1 session"), 64));
	return { key, pub: toBase64(pub) };
}

// Twelve digits from the server's key, the same on every visit unless something swapped it
export function fingerprint(serverPubBase64: string) {
	const digest = sha256(fromBase64(serverPubBase64));
	let value = 0n;
	for (const byte of digest.subarray(0, 8)) {
		value = (value << 8n) | BigInt(byte);
	}
	const digits = (value % 10n ** 12n).toString().padStart(12, "0");
	return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
}

export { decoder, encoder };
