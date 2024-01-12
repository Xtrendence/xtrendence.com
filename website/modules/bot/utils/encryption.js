import forge from 'node-forge';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.join(__dirname, '../.env'),
});

const key = process.env.FIREBASE_ENCRYPTION_KEY;
const iv = process.env.FIREBASE_ENCRYPTION_IV;

export function encrypt(data) {
    const cipher = forge.rc2.createEncryptionCipher(key);
    cipher.start(iv);
    cipher.update(forge.util.createBuffer(data));
    cipher.finish();
    const encrypted = cipher.output;
    return encrypted.toHex();
}

export function decrypt(data) {
    const bufferFromHex = forge.util.hexToBytes(data);
    const byteStringBuffer = new forge.util.ByteStringBuffer(bufferFromHex);
    const cipher = forge.rc2.createDecryptionCipher(key);
    cipher.start(iv);
    cipher.update(byteStringBuffer);
    cipher.finish();
    return cipher.output.toString();
}
