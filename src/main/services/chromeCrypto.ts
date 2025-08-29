import fs from 'fs';
import crypto from 'crypto';

function readLocalState(localStatePath: string): any {
  const raw = fs.readFileSync(localStatePath, 'utf-8');
  return JSON.parse(raw);
}

export function loadChromeMasterKey(localStatePath: string): Buffer | null {
  try {
    const json = readLocalState(localStatePath);
    const b64 = json?.os_crypt?.encrypted_key;
    if (!b64 || typeof b64 !== 'string') return null;
    let enc = Buffer.from(b64, 'base64');
    // On Windows the key is prefixed with 'DPAPI' and must be unprotected.
    // On Linux this prefix may still appear; the rest is the raw AES key.
    const DPAPI = Buffer.from('DPAPI');
    if (enc.slice(0, DPAPI.length).equals(DPAPI)) {
      enc = enc.slice(DPAPI.length);
    }
    return enc; // expected to be 256-bit (32 bytes)
  } catch {
    return null;
  }
}

// Decrypt Chrome/Brave 'v10' AES-GCM value
export function decryptChromeValue(encrypted: Buffer, masterKey: Buffer | null): Buffer | null {
  try {
    if (!encrypted || encrypted.length === 0) return Buffer.alloc(0);
    // Values typically start with 'v10'
    const prefix = encrypted.slice(0, 3).toString();
    if (prefix !== 'v10') {
      // Not encrypted with AES-GCM (possibly plaintext)
      return encrypted;
    }
    if (!masterKey || masterKey.length === 0) return null;

    const iv = encrypted.slice(3, 15); // 12-byte nonce
    const tag = encrypted.slice(encrypted.length - 16); // 16-byte auth tag
    const ciphertext = encrypted.slice(15, encrypted.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted;
  } catch {
    return null;
  }
}
