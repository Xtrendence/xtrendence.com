import forge from 'node-forge';

export function encrypt(data: string, key: string, iv: string) {
  const cipher = forge.rc2.createEncryptionCipher(key);
  cipher.start(iv);
  cipher.update(forge.util.createBuffer(data));
  cipher.finish();
  const encrypted = cipher.output;
  return encrypted.toHex();
}

export function decrypt(data: string, key: string, iv: string) {
  const bufferFromHex = forge.util.hexToBytes(data);
  const byteStringBuffer = new forge.util.ByteStringBuffer(bufferFromHex);
  const cipher = forge.rc2.createDecryptionCipher(key);
  cipher.start(iv);
  cipher.update(byteStringBuffer);
  cipher.finish();
  return cipher.output.toString();
}
