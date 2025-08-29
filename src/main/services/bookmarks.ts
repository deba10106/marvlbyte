import type Database from 'better-sqlite3';

export type Bookmark = {
  id: number;
  title: string;
  url: string;
  createdAt: number;
  tags?: string[];
};

export class BookmarksService {
  private db: Database.Database;
  private insertStmt;
  private listStmt;
  private removeStmt;
  private findByUrlStmt;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = this.db.prepare(
      'INSERT OR IGNORE INTO bookmarks(title, url, createdAt, tags) VALUES (?, ?, ?, ?)' // tags JSON
    );
    this.listStmt = this.db.prepare('SELECT id, title, url, createdAt, tags FROM bookmarks ORDER BY createdAt DESC');
    this.removeStmt = this.db.prepare('DELETE FROM bookmarks WHERE id = ?');
    this.findByUrlStmt = this.db.prepare('SELECT id, title, url, createdAt, tags FROM bookmarks WHERE url = ?');
  }

  add(title: string, url: string, tags?: string[]): Bookmark | undefined {
    const createdAt = Date.now();
    const tagsJson = tags ? JSON.stringify(tags) : null;
    const info = this.insertStmt.run(title, url, createdAt, tagsJson);
    if (info.changes === 0) {
      // already existed; return existing
      const row = this.findByUrlStmt.get(url) as any;
      return row ? { ...row, tags: row.tags ? JSON.parse(row.tags) : undefined } : undefined;
    }
    const row = this.findByUrlStmt.get(url) as any;
    return row ? { ...row, tags: row.tags ? JSON.parse(row.tags) : undefined } : undefined;
  }

  list(): Bookmark[] {
    const rows = this.listStmt.all() as any[];
    return rows.map((r) => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : undefined }));
  }

  remove(id: number): void {
    this.removeStmt.run(id);
  }

  findByUrl(url: string): Bookmark | undefined {
    const row = this.findByUrlStmt.get(url) as any;
    return row ? { ...row, tags: row.tags ? JSON.parse(row.tags) : undefined } : undefined;
  }
}
