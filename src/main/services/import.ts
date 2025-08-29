import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { loadChromeMasterKey, decryptChromeValue } from './chromeCrypto';
import { BookmarksService } from './bookmarks';
import { HistoryService } from './history';
import { getDb } from './db';

export type ImportBrowser = 'chrome' | 'brave' | 'firefox';

export type ImportProfile = {
  id: string; // e.g. chrome:Default
  browser: ImportBrowser;
  name: string; // user-facing name
  paths: {
    root: string; // browser root
    profileDir?: string; // profile directory name
    localState?: string; // Chrome/Brave Local State path
    history?: string; // History sqlite
    bookmarks?: string; // Bookmarks JSON
    cookies?: string; // Cookies sqlite
    logins?: string; // Login Data sqlite
    firefoxPlaces?: string; // Firefox places.sqlite
  };
};

export type ImportPreview = {
  profileId: string;
  browser: ImportBrowser;
  counts: {
    history?: number;
    bookmarks?: number;
    cookies?: number;
    passwords?: number;
    sessions?: number;
  };
  notes?: string[];
};

export type ImportRunOptions = {
  history?: boolean;
  bookmarks?: boolean;
  cookies?: boolean;
  passwords?: boolean;
  sessions?: boolean;
  limit?: number; // optional cap per type for testing
};

export type ImportRunResult = {
  profileId: string;
  browser: ImportBrowser;
  imported: {
    history: number;
    bookmarks: number;
    cookies: number;
    passwords: number;
    sessions: number;
  };
  errors?: string[];
};

function isLinux() {
  return process.platform === 'linux';
}

function toUnixMsFromChromeUs(us: number): number {
  // Chrome stores microseconds since 1601-01-01
  // Convert to Unix ms
  if (!us || us <= 0) return Date.now();
  try {
    const ms = Math.floor(us / 1000 - 11644473600000);
    return ms > 0 ? ms : Date.now();
  } catch {
    return Date.now();
  }

}


function safeExists(p?: string): p is string {
  return !!p && fs.existsSync(p);
}

function listDirs(root: string): string[] {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

// very small INI parser (sufficient for Firefox profiles.ini)
function parseIni(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let section: string | null = null;
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim();
      if (!(section in result)) result[section] = {};
      continue;
    }
    const eq = line.indexOf('=');
    if (eq > 0 && section) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      result[section][k] = v;
    }
  }
  return result;
}

export class ImportService {
  constructor(private bookmarks: BookmarksService, private history: HistoryService) {}

  detectProfiles(): ImportProfile[] {
    const res: ImportProfile[] = [];
    if (!isLinux()) return res;

    const home = os.homedir();

    // Chrome
    const chromeRoot = path.join(home, '.config', 'google-chrome');
    if (fs.existsSync(chromeRoot)) {
      const profiles = ['Default', ...listDirs(chromeRoot).filter((d) => /^Profile \d+$/.test(d))];
      for (const p of profiles) {
        const profileDir = path.join(chromeRoot, p);
        const profile: ImportProfile = {
          id: `chrome:${p}`,
          browser: 'chrome',
          name: `Chrome — ${p}`,
          paths: {
            root: chromeRoot,
            profileDir: p,
            localState: path.join(chromeRoot, 'Local State'),
            history: path.join(profileDir, 'History'),
            bookmarks: path.join(profileDir, 'Bookmarks'),
            cookies: path.join(profileDir, 'Cookies'),
            logins: path.join(profileDir, 'Login Data'),
          },
        };
        res.push(profile);
      }
    }

    // Brave
    const braveRoot = path.join(home, '.config', 'BraveSoftware', 'Brave-Browser');
    if (fs.existsSync(braveRoot)) {
      const profiles = ['Default', ...listDirs(braveRoot).filter((d) => /^Profile \d+$/.test(d))];
      for (const p of profiles) {
        const profileDir = path.join(braveRoot, p);
        const profile: ImportProfile = {
          id: `brave:${p}`,
          browser: 'brave',
          name: `Brave — ${p}`,
          paths: {
            root: braveRoot,
            profileDir: p,
            localState: path.join(braveRoot, 'Local State'),
            history: path.join(profileDir, 'History'),
            bookmarks: path.join(profileDir, 'Bookmarks'),
            cookies: path.join(profileDir, 'Cookies'),
            logins: path.join(profileDir, 'Login Data'),
          },
        };
        res.push(profile);
      }
    }

    // Firefox (robust detection via profiles.ini with fallback)
    const ffRoot = path.join(home, '.mozilla', 'firefox');
    if (fs.existsSync(ffRoot)) {
      const iniPath = path.join(ffRoot, 'profiles.ini');
      let pushed = 0;
      if (fs.existsSync(iniPath)) {
        try {
          const txt = fs.readFileSync(iniPath, 'utf-8');
          const ini = parseIni(txt);
          const entries = Object.entries(ini).filter(([sec]) => /^Profile\d+$/i.test(sec));
          for (const [, data] of entries) {
            const rawPath = data['Path'];
            if (!rawPath) continue;
            const isRel = data['IsRelative'] === '1';
            const absPath = isRel ? path.join(ffRoot, rawPath) : rawPath;
            const dirName = path.basename(absPath);
            const name = data['Name'] ? `Firefox — ${data['Name']}${data['Default']==='1' ? ' (Default)' : ''}` : `Firefox — ${dirName}`;
            const profile: ImportProfile = {
              id: `firefox:${dirName}`,
              browser: 'firefox',
              name,
              paths: {
                root: ffRoot,
                profileDir: dirName,
                firefoxPlaces: path.join(absPath, 'places.sqlite'),
                cookies: path.join(absPath, 'cookies.sqlite'),
                logins: path.join(absPath, 'logins.json'),
              },
            };
            res.push(profile);
            pushed += 1;
          }
        } catch {}
      }
      // Fallback: scan directories ending with .default*
      if (pushed === 0) {
        const profiles = listDirs(ffRoot).filter((d) => /\.default/.test(d));
        for (const p of profiles) {
          const profileDir = path.join(ffRoot, p);
          const profile: ImportProfile = {
            id: `firefox:${p}`,
            browser: 'firefox',
            name: `Firefox — ${p}`,
            paths: {
              root: ffRoot,
              profileDir: p,
              firefoxPlaces: path.join(profileDir, 'places.sqlite'),
              cookies: path.join(profileDir, 'cookies.sqlite'),
              logins: path.join(profileDir, 'logins.json'),
            },
          };
          res.push(profile);
        }
      }
    }

    return res;
  }

  async preview(profileId: string): Promise<ImportPreview> {
    const all = this.detectProfiles();
    const prof = all.find((p) => p.id === profileId);
    if (!prof) throw new Error('Profile not found');

    const counts: ImportPreview['counts'] = {};
    const notes: string[] = [];

    if (prof.browser === 'chrome' || prof.browser === 'brave') {
      // History count
      if (safeExists(prof.paths.history)) {
        try {
          const tmp = this.copyToTmp(prof.paths.history!);
          const db = new Database(tmp, { readonly: true });
          const row = db.prepare('SELECT COUNT(1) as n FROM urls').get() as any;
          counts.history = Number(row?.n || 0);
          db.close();
          fs.rmSync(tmp, { force: true });
        } catch (e: any) {
          notes.push(`History preview failed: ${e?.message || String(e)}`);
        }
      }
      // Bookmarks count
      if (safeExists(prof.paths.bookmarks)) {
        try {
          const raw = fs.readFileSync(prof.paths.bookmarks!, 'utf-8');
          const json = JSON.parse(raw);
          counts.bookmarks = this.countChromeBookmarks(json);
        } catch (e: any) {
          notes.push(`Bookmarks preview failed: ${e?.message || String(e)}`);
        }
      }
      // Cookies count
      if (safeExists(prof.paths.cookies)) {
        try {
          const tmp = this.copyToTmp(prof.paths.cookies!);
          const db = new Database(tmp, { readonly: true });
          const row = db.prepare('SELECT COUNT(1) as n FROM cookies').get() as any;
          counts.cookies = Number(row?.n || 0);
          db.close();
          fs.rmSync(tmp, { force: true });
        } catch (e: any) {
          notes.push(`Cookies preview failed: ${e?.message || String(e)}`);
        }
      }
      // Passwords count
      if (safeExists(prof.paths.logins)) {
        try {
          const tmp = this.copyToTmp(prof.paths.logins!);
          const db = new Database(tmp, { readonly: true });
          const row = db.prepare('SELECT COUNT(1) as n FROM logins').get() as any;
          counts.passwords = Number(row?.n || 0);
          db.close();
          fs.rmSync(tmp, { force: true });
        } catch (e: any) {
          notes.push(`Passwords preview failed: ${e?.message || String(e)}`);
        }
      }
    } else if (prof.browser === 'firefox') {
      if (safeExists(prof.paths.firefoxPlaces)) {
        try {
          const tmp = this.copyToTmp(prof.paths.firefoxPlaces!);
          const db = new Database(tmp, { readonly: true });
          const h = db.prepare('SELECT COUNT(1) AS n FROM moz_places WHERE url IS NOT NULL').get() as any;
          const b = db.prepare('SELECT COUNT(1) AS n FROM moz_bookmarks WHERE type = 1').get() as any;
          counts.history = Number(h?.n || 0);
          counts.bookmarks = Number(b?.n || 0);
          db.close();
          fs.rmSync(tmp, { force: true });
        } catch (e: any) {
          notes.push(`Firefox preview failed: ${e?.message || String(e)}`);
        }
      }
    }

    return { profileId: prof.id, browser: prof.browser, counts, notes };
  }

  async run(profileId: string, opts: ImportRunOptions = {}): Promise<ImportRunResult> {
    const all = this.detectProfiles();
    const prof = all.find((p) => p.id === profileId);
    if (!prof) throw new Error('Profile not found');

    const result: ImportRunResult = {
      profileId: prof.id,
      browser: prof.browser,
      imported: { history: 0, bookmarks: 0, cookies: 0, passwords: 0, sessions: 0 },
      errors: [],
    };

    try {
      if ((opts.history ?? true) && (prof.browser === 'chrome' || prof.browser === 'brave') && safeExists(prof.paths.history)) {
        result.imported.history = this.importChromeLikeHistory(prof.paths.history!, opts.limit);
      }
    } catch (e: any) {
      result.errors!.push(`History import failed: ${e?.message || String(e)}`);
    }

    try {
      if ((opts.bookmarks ?? true) && (prof.browser === 'chrome' || prof.browser === 'brave') && safeExists(prof.paths.bookmarks)) {
        result.imported.bookmarks = this.importChromeLikeBookmarks(prof.paths.bookmarks!);
      }
    } catch (e: any) {
      result.errors!.push(`Bookmarks import failed: ${e?.message || String(e)}`);
    }

    try {
      if ((opts.cookies ?? false) && (prof.browser === 'chrome' || prof.browser === 'brave') && safeExists(prof.paths.cookies)) {
        result.imported.cookies = this.importChromeLikeCookies(
          prof.paths.cookies!,
          prof.paths.localState,
          prof.browser
        );
      }
    } catch (e: any) {
      result.errors!.push(`Cookies import failed: ${e?.message || String(e)}`);
    }

    try {
      if ((opts.passwords ?? false) && (prof.browser === 'chrome' || prof.browser === 'brave') && safeExists(prof.paths.logins)) {
        result.imported.passwords = this.importChromeLikePasswords(
          prof.paths.logins!,
          prof.paths.localState,
          prof.browser
        );
      }
    } catch (e: any) {
      result.errors!.push(`Passwords import failed: ${e?.message || String(e)}`);
    }

    try {
      if ((opts.history ?? true) && prof.browser === 'firefox' && safeExists(prof.paths.firefoxPlaces)) {
        result.imported.history = this.importFirefoxHistory(prof.paths.firefoxPlaces!, opts.limit);
      }
    } catch (e: any) {
      result.errors!.push(`Firefox history import failed: ${e?.message || String(e)}`);
    }

    try {
      if ((opts.bookmarks ?? true) && prof.browser === 'firefox' && safeExists(prof.paths.firefoxPlaces)) {
        result.imported.bookmarks = this.importFirefoxBookmarks(prof.paths.firefoxPlaces!);
      }
    } catch (e: any) {
      result.errors!.push(`Firefox bookmarks import failed: ${e?.message || String(e)}`);
    }

    return result;
  }

  // --- Helpers ---

  private copyToTmp(src: string): string {
    const dst = path.join(os.tmpdir(), `comet-import-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
    fs.copyFileSync(src, dst);
    return dst;
  }

  private countChromeBookmarks(json: any): number {
    let count = 0;
    function walk(node: any) {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const c of node) walk(c);
        return;
      }
      if (node.type === 'url' && typeof node.url === 'string') {
        count += 1;
      }
      if (node.children) walk(node.children);
      if (node.roots) {
        walk(node.roots.bookmark_bar);
        walk(node.roots.other);
        walk(node.roots.synced);
      }
    }
    walk(json);
    return count;
  }

  private importChromeLikeBookmarks(filePath: string): number {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);
    const items: Array<{ title: string; url: string }> = [];

    function walk(node: any) {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const c of node) walk(c);
        return;
      }
      if (node.type === 'url' && typeof node.url === 'string') {
        items.push({ title: String(node.name || node.url), url: String(node.url) });
      }
      if (node.children) walk(node.children);
      if (node.roots) {
        walk(node.roots.bookmark_bar);
        walk(node.roots.other);
        walk(node.roots.synced);
      }
    }

    walk(json);

    let imported = 0;
    for (const it of items) {
      try {
        const existed = this.bookmarks.findByUrl(it.url);
        if (!existed) {
          this.bookmarks.add(it.title, it.url);
          imported += 1;
        }
      } catch {}
    }
    return imported;
  }

  private importChromeLikeHistory(filePath: string, limit?: number): number {
    const tmp = this.copyToTmp(filePath);
    const src = new Database(tmp, { readonly: true });
    try {
      const rows = src
        .prepare('SELECT url, title, last_visit_time, visit_count FROM urls ORDER BY last_visit_time DESC')
        .all() as Array<{ url: string; title: string; last_visit_time: number; visit_count: number }>;

      const max = typeof limit === 'number' && limit > 0 ? Math.min(limit, rows.length) : rows.length;
      const db = getDb();
      const insert = db.prepare('INSERT OR IGNORE INTO history(url, title, visitAt, visitCount) VALUES (?, ?, ?, ?)');
      const update = db.prepare('UPDATE history SET title = ?, visitAt = ?, visitCount = MAX(visitCount, ?) WHERE url = ?');

      const txn = db.transaction((slice: typeof rows) => {
        for (let i = 0; i < slice.length; i++) {
          if (i >= max) break;
          const r = slice[i];
          const ts = toUnixMsFromChromeUs(Number(r.last_visit_time || 0));
          try {
            const info = insert.run(r.url, r.title || r.url, ts, Math.max(1, Number(r.visit_count || 1)));
            if (info.changes === 0) {
              update.run(r.title || r.url, ts, Math.max(1, Number(r.visit_count || 1)), r.url);
            }
          } catch {
            // ignore individual row errors
          }
        }
      });

      txn(rows);
      return max;
    } finally {
      try { src.close(); } catch {}
      try { fs.rmSync(tmp, { force: true }); } catch {}
    }
  }

  private importChromeLikeCookies(filePath: string, localStatePath?: string, source: string = 'chrome'): number {
    const tmp = this.copyToTmp(filePath);
    const src = new Database(tmp, { readonly: true });
    const masterKey = localStatePath ? loadChromeMasterKey(localStatePath) : null;
    try {
      const rows = src.prepare('SELECT * FROM cookies').all() as Array<any>;
      const db = getDb();
      const insert = db.prepare(
        'INSERT OR REPLACE INTO cookies(host, name, value, path, createdAt, expiresAt, lastAccessedAt, secure, httpOnly, sameSite, source) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
      );
      const txn = db.transaction((slice: typeof rows) => {
        for (const r of slice) {
          try {
            const enc: Buffer = r.encrypted_value ? (Buffer.isBuffer(r.encrypted_value) ? r.encrypted_value : Buffer.from(r.encrypted_value)) : Buffer.alloc(0);
            let valBuf: Buffer | null = null;
            if (enc.length > 0) {
              valBuf = decryptChromeValue(enc, masterKey);
            }
            if (!valBuf) {
              const v: string = r.value ?? '';
              valBuf = Buffer.from(String(v));
            }
            const createdAt = toUnixMsFromChromeUs(Number(r.creation_utc || 0));
            const expiresAt = toUnixMsFromChromeUs(Number(r.expires_utc || 0));
            const lastAccessedAt = toUnixMsFromChromeUs(Number(r.last_access_utc || 0));
            const sameSite = r.samesite == null ? null : String(r.samesite);
            insert.run(
              String(r.host_key || ''),
              String(r.name || ''),
              valBuf,
              String(r.path || '/'),
              createdAt,
              expiresAt > 0 ? expiresAt : null,
              lastAccessedAt,
              Number(r.is_secure || 0) ? 1 : 0,
              Number(r.is_httponly || 0) ? 1 : 0,
              sameSite,
              source
            );
          } catch {
            // ignore row
          }
        }
      });
      txn(rows);
      return rows.length;
    } finally {
      try { src.close(); } catch {}
      try { fs.rmSync(tmp, { force: true }); } catch {}
    }
  }

  private importChromeLikePasswords(filePath: string, localStatePath?: string, source: string = 'chrome'): number {
    const tmp = this.copyToTmp(filePath);
    const src = new Database(tmp, { readonly: true });
    const masterKey = localStatePath ? loadChromeMasterKey(localStatePath) : null;
    try {
      const rows = src.prepare('SELECT * FROM logins').all() as Array<any>;
      const db = getDb();
      const insert = db.prepare(
        'INSERT OR REPLACE INTO logins(origin, username, password, realm, formActionOrigin, timesUsed, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)'
      );
      const txn = db.transaction((slice: typeof rows) => {
        for (const r of slice) {
          try {
            const enc: Buffer = r.password_value ? (Buffer.isBuffer(r.password_value) ? r.password_value : Buffer.from(r.password_value)) : Buffer.alloc(0);
            const dec = enc.length > 0 ? decryptChromeValue(enc, masterKey) : Buffer.alloc(0);
            const createdAt = toUnixMsFromChromeUs(Number(r.date_created || 0));
            const updatedAt = toUnixMsFromChromeUs(Number(r.date_password_modified || r.date_last_used || 0));
            insert.run(
              String(r.origin_url || ''),
              r.username_value != null ? String(r.username_value) : null,
              dec,
              r.signon_realm != null ? String(r.signon_realm) : null,
              r.action_url != null ? String(r.action_url) : (r.form_action_origin != null ? String(r.form_action_origin) : null),
              Number(r.times_used || 0),
              createdAt,
              updatedAt > 0 ? updatedAt : null
            );
          } catch {
            // ignore row
          }
        }
      });
      txn(rows);
      return rows.length;
    } finally {
      try { src.close(); } catch {}
      try { fs.rmSync(tmp, { force: true }); } catch {}
    }
  }

  private importFirefoxHistory(filePath: string, limit?: number): number {
    const tmp = this.copyToTmp(filePath);
    const src = new Database(tmp, { readonly: true });
    try {
      const rows = src
        .prepare('SELECT url, title, last_visit_date, visit_count FROM moz_places WHERE url IS NOT NULL ORDER BY last_visit_date DESC')
        .all() as Array<{ url: string; title: string | null; last_visit_date: number | null; visit_count: number | null }>;

      const max = typeof limit === 'number' && limit > 0 ? Math.min(limit, rows.length) : rows.length;
      const db = getDb();
      const insert = db.prepare('INSERT OR IGNORE INTO history(url, title, visitAt, visitCount) VALUES (?, ?, ?, ?)');
      const update = db.prepare('UPDATE history SET title = ?, visitAt = ?, visitCount = MAX(visitCount, ?) WHERE url = ?');

      const txn = db.transaction((slice: typeof rows) => {
        for (let i = 0; i < slice.length; i++) {
          if (i >= max) break;
          const r = slice[i];
          const ts = (() => {
            const v = Number(r.last_visit_date || 0);
            // Firefox stores microseconds since Unix epoch
            const ms = Math.floor(v / 1000);
            return ms > 0 ? ms : Date.now();
          })();
          try {
            const info = insert.run(r.url, r.title || r.url, ts, Math.max(1, Number(r.visit_count || 1)));
            if (info.changes === 0) {
              update.run(r.title || r.url, ts, Math.max(1, Number(r.visit_count || 1)), r.url);
            }
          } catch {
            // ignore row
          }
        }
      });

      txn(rows);
      return max;
    } finally {
      try { src.close(); } catch {}
      try { fs.rmSync(tmp, { force: true }); } catch {}
    }
  }

  private importFirefoxBookmarks(filePath: string): number {
    const tmp = this.copyToTmp(filePath);
    const src = new Database(tmp, { readonly: true });
    try {
      const rows = src
        .prepare(`
          SELECT COALESCE(b.title, p.title, p.url) AS title, p.url AS url
          FROM moz_bookmarks b
          JOIN moz_places p ON b.fk = p.id
          WHERE b.type = 1 AND p.url IS NOT NULL
        `)
        .all() as Array<{ title: string | null; url: string }>;

      let imported = 0;
      for (const r of rows) {
        try {
          const existed = this.bookmarks.findByUrl(r.url);
          if (!existed) {
            this.bookmarks.add(r.title || r.url, r.url);
            imported += 1;
          }
        } catch {}
      }
      return imported;
    } finally {
      try { src.close(); } catch {}
      try { fs.rmSync(tmp, { force: true }); } catch {}
    }
  }
}
