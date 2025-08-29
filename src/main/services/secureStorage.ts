import fs from 'fs';
import os from 'os';
import path from 'path';

// Lightweight secure storage wrapper.
// - Uses keytar if available (optional dependency)
// - Falls back to JSON file under ~/.config/comet/secure-store.json

let keytar: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  keytar = require('keytar');
} catch {
  keytar = null;
}

function getFallbackFile(): string {
  const base = path.join(os.homedir(), '.config', 'comet');
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return path.join(base, 'secure-store.json');
}

function readFallback(): Record<string, Record<string, string>> {
  const f = getFallbackFile();
  if (!fs.existsSync(f)) return {};
  try {
    return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch {
    return {};
  }
}

function writeFallback(obj: Record<string, Record<string, string>>) {
  const f = getFallbackFile();
  try {
    fs.writeFileSync(f, JSON.stringify(obj, null, 2));
  } catch {}
}

export class SecureStorage {
  constructor(private service = 'Comet') {}

  async set(key: string, value: string): Promise<void> {
    if (keytar) {
      await keytar.setPassword(this.service, key, value);
      return;
    }
    const data = readFallback();
    if (!data[this.service]) data[this.service] = {};
    data[this.service][key] = value;
    writeFallback(data);
  }

  async get(key: string): Promise<string | null> {
    if (keytar) {
      return (await keytar.getPassword(this.service, key)) ?? null;
    }
    const data = readFallback();
    return data[this.service]?.[key] ?? null;
  }

  async delete(key: string): Promise<void> {
    if (keytar) {
      await keytar.deletePassword(this.service, key);
      return;
    }
    const data = readFallback();
    if (data[this.service]) {
      delete data[this.service][key];
      writeFallback(data);
    }
  }
}
