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

if (
    !key ||
    !iv ||
    forge.util.hexToBytes(key).length !== 16 ||
    forge.util.hexToBytes(iv).length !== 16
) {
    const suggestedKey = forge.util.bytesToHex(forge.random.getBytesSync(16));
    const suggestedIV = forge.util.bytesToHex(forge.random.getBytesSync(16));
    console.log(`Suggested Key: ${suggestedKey}`);
    console.log(`Suggested IV: ${suggestedIV}`);
    throw new Error('Missing encryption key or IV');
}

export function encrypt(data) {
    const cipher = forge.cipher.createCipher(
        'AES-CBC',
        forge.util.hexToBytes(key)
    );
    cipher.start({ iv });
    cipher.update(forge.util.createBuffer(data));
    cipher.finish();
    const encrypted = cipher.output;
    return encrypted.toHex();
}

export function decrypt(data) {
    const bufferFromHex = forge.util.hexToBytes(data);
    const byteStringBuffer = new forge.util.ByteStringBuffer(bufferFromHex);
    const decipher = forge.cipher.createDecipher(
        'AES-CBC',
        forge.util.hexToBytes(key)
    );
    decipher.start({ iv });
    decipher.update(byteStringBuffer);
    return decipher.output.toString();
}

export function base64Encode(data) {
    return forge.util.encode64(data);
}

export function base64Decode(data) {
    return forge.util.decode64(data);
}
