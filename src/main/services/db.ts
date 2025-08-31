import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

let dbInstance: Database.Database | null = null;

function getDefaultDbPath(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Comet', 'comet.db');
    }
  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Comet', 'comet.db');
  }
  return path.join(os.homedir(), '.config', 'comet', 'comet.db');
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function initSchema(db: Database.Database) {
  db.pragma('journal_mode = WAL');

  // Drop any legacy triggers that may conflict (names may have changed across versions)
  try {
    const listTriggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name = ?");
    for (const tbl of ['history', 'documents']) {
      const rows = listTriggers.all(tbl) as Array<{ name: string }>;
      for (const r of rows) {
        try { db.exec(`DROP TRIGGER IF EXISTS ${r.name}`); } catch {}
      }
    }
  } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      createdAt INTEGER NOT NULL,
      tags TEXT
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      title TEXT,
      visitAt INTEGER NOT NULL,
      visitCount INTEGER NOT NULL DEFAULT 1
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(title, url, content='');

    -- Ensure triggers are up-to-date and compatible with contentless FTS5 (no UPDATE allowed)
    DROP TRIGGER IF EXISTS history_ai;
    DROP TRIGGER IF EXISTS history_au;
    DROP TRIGGER IF EXISTS history_ad;
    CREATE TRIGGER history_ai AFTER INSERT ON history BEGIN
      INSERT INTO history_fts(rowid, title, url) VALUES (new.id, coalesce(new.title,''), new.url);
    END;
    CREATE TRIGGER history_au AFTER UPDATE ON history BEGIN
      INSERT INTO history_fts(history_fts, rowid) VALUES('delete', old.id);
      INSERT INTO history_fts(rowid, title, url) VALUES (new.id, coalesce(new.title,''), new.url);
    END;
    CREATE TRIGGER history_ad AFTER DELETE ON history BEGIN
      INSERT INTO history_fts(history_fts, rowid) VALUES('delete', old.id);
    END;

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      title TEXT,
      content TEXT,
      indexedAt INTEGER NOT NULL,
      size INTEGER,
      mime TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(title, content, path, content='');
    -- Ensure document FTS triggers are rebuilt (also must avoid UPDATE)
    DROP TRIGGER IF EXISTS documents_ai;
    DROP TRIGGER IF EXISTS documents_au;
    DROP TRIGGER IF EXISTS documents_ad;
    DROP TRIGGER IF EXISTS documents_ai;
    DROP TRIGGER IF EXISTS documents_au;
    DROP TRIGGER IF EXISTS documents_ad;
    CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, title, content, path) VALUES (new.id, coalesce(new.title,''), coalesce(new.content,''), new.path);
    END;
    CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid) VALUES('delete', old.id);
      INSERT INTO documents_fts(rowid, title, content, path) VALUES (new.id, coalesce(new.title,''), coalesce(new.content,''), new.path);
    END;
    CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid) VALUES('delete', old.id);
    END;

    -- Cookies storage (value is expected to be encrypted in future revisions)
    CREATE TABLE IF NOT EXISTS cookies (
      id INTEGER PRIMARY KEY,
      host TEXT NOT NULL,
      name TEXT NOT NULL,
      value BLOB,
      path TEXT NOT NULL DEFAULT '/',
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER,
      lastAccessedAt INTEGER,
      secure INTEGER NOT NULL DEFAULT 0,
      httpOnly INTEGER NOT NULL DEFAULT 0,
      sameSite TEXT,
      source TEXT,
      UNIQUE(host, name, path)
    );
    CREATE INDEX IF NOT EXISTS idx_cookies_host_name ON cookies(host, name);

    -- Password logins (password is expected to be encrypted in future revisions)
    CREATE TABLE IF NOT EXISTS logins (
      id INTEGER PRIMARY KEY,
      origin TEXT NOT NULL,
      username TEXT,
      password BLOB,
      realm TEXT,
      formActionOrigin TEXT,
      timesUsed INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER,
      UNIQUE(origin, username)
    );
    CREATE INDEX IF NOT EXISTS idx_logins_origin ON logins(origin);
    
    -- Tool registry
    CREATE TABLE IF NOT EXISTS tool_definitions (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      title TEXT,
      description TEXT,
      engine TEXT NOT NULL,
      schema TEXT,
      config TEXT,
      approval TEXT NOT NULL DEFAULT 'auto',
      rateLimit INTEGER,
      redaction TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_tool_definitions_name ON tool_definitions(name);

    -- Tool audit logs
    CREATE TABLE IF NOT EXISTS tool_audit (
      id INTEGER PRIMARY KEY,
      toolName TEXT NOT NULL,
      ts INTEGER NOT NULL,
      input TEXT,
      output TEXT,
      approved INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      durationMs INTEGER,
      redacted INTEGER NOT NULL DEFAULT 0,
      caller TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tool_audit_toolName_ts ON tool_audit(toolName, ts);
  `);
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;
  const dbPath = process.env.COMET_DB || getDefaultDbPath();
  ensureDir(dbPath);
  const db = new Database(dbPath);
  initSchema(db);
  dbInstance = db;
  return db;
}
