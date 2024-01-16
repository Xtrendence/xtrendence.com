import forge from 'node-forge';

export function encrypt(data: string, key: string, iv: string) {
  const cipher = forge.cipher.createCipher(
    'AES-CBC',
    forge.util.hexToBytes(key),
  );
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(data));
  cipher.finish();
  const encrypted = cipher.output;
  return encrypted.toHex();
}

export function decrypt(data: string, key: string, iv: string) {
  const bufferFromHex = forge.util.hexToBytes(data);
  const byteStringBuffer = new forge.util.ByteStringBuffer(bufferFromHex);
  const decipher = forge.cipher.createDecipher(
    'AES-CBC',
    forge.util.hexToBytes(key),
  );
  decipher.start({ iv });
  decipher.update(byteStringBuffer);
  return decipher.output.toString();
}

export function base64Encode(data: string) {
  return forge.util.encode64(data);
}

export function base64Decode(data: string) {
  return forge.util.decode64(data);
}
