import {
	createCipheriv,
	createHash,
	createHmac,
	createPrivateKey,
	createPublicKey,
	diffieHellman,
	generateKeyPairSync,
	hkdfSync,
	type KeyObject,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";
import fs from "node:fs";
import { SERVER_KEY } from "./config";

// The same scheme as the browser side: X25519, HKDF-SHA-256, then AES-256-CTR with HMAC-SHA-256

type TJwk = { kty: "OKP"; crv: "X25519"; x: string; d?: string };

export type TServerKey = { privateKey: KeyObject; pub: Buffer };

// Kept across restarts so the browser can pin it, a changed key means something is in the way
export function loadServerKey(): TServerKey {
	let jwk: TJwk;
	try {
		jwk = JSON.parse(fs.readFileSync(SERVER_KEY, "utf-8"));
	} catch {
		const { privateKey } = generateKeyPairSync("x25519");
		jwk = privateKey.export({ format: "jwk" }) as TJwk;
		fs.writeFileSync(SERVER_KEY, JSON.stringify(jwk), { mode: 0o600 });
	}
	return {
		privateKey: createPrivateKey({ key: jwk, format: "jwk" }),
		pub: Buffer.from(jwk.x, "base64url"),
	};
}

export type TSessionKey = { enc: Buffer; mac: Buffer };

export function deriveSessionKey(server: TServerKey, clientPub: Buffer): TSessionKey | null {
	if (clientPub.length !== 32) {
		return null;
	}
	const publicKey = createPublicKey({ key: { kty: "OKP", crv: "X25519", x: clientPub.toString("base64url") }, format: "jwk" });
	const shared = diffieHellman({ privateKey: server.privateKey, publicKey });
	if (shared.every((byte) => byte === 0)) {
		return null;
	}
	const salt = createHash("sha256").update(Buffer.concat([clientPub, server.pub])).digest();
	const material = Buffer.from(hkdfSync("sha256", shared, salt, "vault v1 session", 64));
	return { enc: material.subarray(0, 32), mac: material.subarray(32, 64) };
}

// The label names the direction and request number, so nothing can be replayed or bounced back
const mac = (key: TSessionKey, label: string, counter: Buffer, body: Buffer) =>
	createHmac("sha256", key.mac).update(label).update(counter).update(body).digest();

export function seal(key: TSessionKey, label: string, data: Buffer) {
	const counter = randomBytes(16);
	counter.fill(0, 12);
	const cipher = createCipheriv("aes-256-ctr", key.enc, counter);
	const body = Buffer.concat([cipher.update(data), cipher.final()]);
	return Buffer.concat([counter, body, mac(key, label, counter, body)]);
}

export function open(key: TSessionKey, label: string, sealed: Buffer) {
	if (sealed.length < 48) {
		return null;
	}
	const counter = sealed.subarray(0, 16);
	const body = sealed.subarray(16, sealed.length - 32);
	const tag = sealed.subarray(sealed.length - 32);
	if (!timingSafeEqual(tag, mac(key, label, counter, body))) {
		return null;
	}
	const decipher = createCipheriv("aes-256-ctr", key.enc, counter);
	return Buffer.concat([decipher.update(body), decipher.final()]);
}
