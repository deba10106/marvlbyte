import type Database from 'better-sqlite3';

export type HistoryEntry = {
  id: number;
  url: string;
  title: string;
  visitAt: number;
  visitCount: number;
};

export class HistoryService {
  private db: Database.Database;

  private insertStmt;
  private updateStmt;
  private getStmt;
  private listStmt;
  private suggestFtsStmt;
  private suggestLikeStmt;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = db.prepare('INSERT OR IGNORE INTO history(url, title, visitAt, visitCount) VALUES (?, ?, ?, 1)');
    this.updateStmt = db.prepare('UPDATE history SET title = ?, visitAt = ?, visitCount = visitCount + 1 WHERE url = ?');
    this.getStmt = db.prepare('SELECT id, url, title, visitAt, visitCount FROM history WHERE url = ?');
    this.listStmt = db.prepare('SELECT id, url, title, visitAt, visitCount FROM history ORDER BY visitAt DESC LIMIT ? OFFSET ?');
    this.suggestFtsStmt = db.prepare(
      "SELECT h.url, h.title FROM history_fts f JOIN history h ON h.id = f.rowid WHERE history_fts MATCH ? LIMIT 10"
    );
    this.suggestLikeStmt = db.prepare(
      "SELECT url, title FROM history WHERE url LIKE ? OR title LIKE ? ORDER BY visitCount DESC LIMIT 10"
    );
  }

  recordVisit(url: string, title: string) {
    const now = Date.now();
    const info = this.insertStmt.run(url, title, now);
    if (info.changes === 0) {
      this.updateStmt.run(title, now, url);
    }
  }

  list(opts?: { limit?: number; offset?: number; prefix?: string }): HistoryEntry[] {
    const limit = Math.max(1, Math.min(200, opts?.limit ?? 100));
    const offset = Math.max(0, opts?.offset ?? 0);
    if (opts?.prefix) {
      const q = `%${opts.prefix}%`;
      const stmt = this.db.prepare(
        'SELECT id, url, title, visitAt, visitCount FROM history WHERE url LIKE ? OR title LIKE ? ORDER BY visitAt DESC LIMIT ? OFFSET ?'
      );
      return stmt.all(q, q, limit, offset) as HistoryEntry[];
    }
    return this.listStmt.all(limit, offset) as HistoryEntry[];
  }

  suggest(prefix: string): Array<{ url: string; title: string; score?: number }> {
    if (!prefix) return [];
    try {
      // try FTS first
      const rows = this.suggestFtsStmt.all(prefix + '*') as any[];
      return rows.map((r) => ({ url: r.url, title: r.title }));
    } catch {
      const like = `%${prefix}%`;
      const rows = this.suggestLikeStmt.all(like, like) as any[];
      return rows.map((r) => ({ url: r.url, title: r.title }));
    }
  }
}
