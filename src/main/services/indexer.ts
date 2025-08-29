import type Database from 'better-sqlite3';
import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import type { AppConfig } from './config';

export type LocalSearchResult =
  | { type: 'document'; path: string; title: string; snippet?: string; indexedAt: number; size?: number; mime?: string }
  | { type: 'history'; url: string; title: string };

const TEXT_EXTS = new Set([
  '.txt',
  '.md',
  '.mdx',
  '.markdown',
  '.html',
  '.htm',
  '.json',
  '.log',
  '.csv',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.yml',
  '.yaml',
]);

function guessMime(p: string): string | undefined {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'text/html';
  if (ext === '.json') return 'application/json';
  if (ext === '.csv') return 'text/csv';
  return 'text/plain';
}

export class IndexerService {
  private cfg: AppConfig;
  private db: Database.Database;
  private watcher: chokidar.FSWatcher | null = null;
  private insertDocStmt;
  private updateDocStmt;
  private findDocStmt;
  private deleteDocStmt;
  private searchDocsStmt;
  private searchHistoryStmt;
  private searchDocsLikeStmt;
  private searchHistoryLikeStmt;

  constructor(cfg: AppConfig, db: Database.Database) {
    this.cfg = cfg;
    this.db = db;

    this.insertDocStmt = db.prepare(
      `INSERT INTO documents(path, title, content, indexedAt, size, mime)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET title=excluded.title, content=excluded.content, indexedAt=excluded.indexedAt, size=excluded.size, mime=excluded.mime`
    );
    this.updateDocStmt = db.prepare(
      `UPDATE documents SET title = ?, content = ?, indexedAt = ?, size = ?, mime = ? WHERE path = ?`
    );
    this.findDocStmt = db.prepare('SELECT id, path, title, indexedAt, size, mime FROM documents WHERE path = ?');
    this.deleteDocStmt = db.prepare('DELETE FROM documents WHERE path = ?');

    // FTS search on documents and history
    this.searchDocsStmt = db.prepare(
      `SELECT d.path, d.title,
              snippet(documents_fts, 1, '<b>', '</b>', ' … ', 10) AS snippet,
              d.indexedAt, d.size, d.mime
       FROM documents_fts f
       JOIN documents d ON d.id = f.rowid
       WHERE documents_fts MATCH ?
       LIMIT 20`
    );
    this.searchHistoryStmt = db.prepare(
      `SELECT h.url, h.title
       FROM history_fts f
       JOIN history h ON h.id = f.rowid
       WHERE history_fts MATCH ?
       LIMIT 10`
    );

    // LIKE fallbacks when FTS parser rejects the query (e.g., contains '.')
    this.searchDocsLikeStmt = db.prepare(
      `SELECT path, title, indexedAt, size, mime
       FROM documents
       WHERE title LIKE ? OR path LIKE ?
       ORDER BY indexedAt DESC
       LIMIT 20`
    );
    this.searchHistoryLikeStmt = db.prepare(
      `SELECT url, title
       FROM history
       WHERE title LIKE ? OR url LIKE ?
       ORDER BY visitCount DESC
       LIMIT 10`
    );
  }

  async start(): Promise<void> {
    if (!this.cfg.indexer.enabled) return;
    const dirs = (this.cfg.indexer.documents.enabled && this.cfg.indexer.documents.directories) || [];
    if (!dirs.length) return;

    // Initial scan
    for (const dir of dirs) {
      await this.scanDir(dir);
    }

    // Watch for changes
    this.watcher = chokidar.watch(dirs, {
      ignored: this.cfg.indexer.excludeGlobs.length ? this.cfg.indexer.excludeGlobs : undefined,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: true,
    });

    this.watcher
      .on('add', (p: string) => this.maybeIndex(p))
      .on('change', (p: string) => this.maybeIndex(p))
      .on('unlink', (p: string) => this.removePath(p));
  }

  stop() {
    this.watcher?.close();
    this.watcher = null;
  }

  async scanDir(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        // skip excluded globs handled by watcher; for scan do a basic skip of .git
        if (ent.name === '.git') continue;
        await this.scanDir(p);
      } else if (ent.isFile()) {
        await this.maybeIndex(p);
      }
    }
  }

  private async maybeIndex(p: string) {
    const ext = path.extname(p).toLowerCase();
    if (!TEXT_EXTS.has(ext)) return;
    try {
      const stat = await fs.promises.stat(p);
      if (stat.size > 2 * 1024 * 1024) return; // 2 MB cap for now
      const raw = await fs.promises.readFile(p, 'utf-8');
      const content = raw.slice(0, 200_000); // cap content length
      const title = path.basename(p);
      const indexedAt = Date.now();
      const mime = guessMime(p);
      this.insertDocStmt.run(p, title, content, indexedAt, stat.size, mime);
    } catch (e) {
      // ignore file errors
    }
  }

  private removePath(p: string) {
    try {
      this.deleteDocStmt.run(p);
    } catch {}
  }

  searchLocal(query: string): LocalSearchResult[] {
    if (!query?.trim()) return [];
    const q = query.includes('*') ? query : `${query}*`;
    let docs: LocalSearchResult[] = [];
    let hist: LocalSearchResult[] = [];
    try {
      docs = (this.searchDocsStmt.all(q) as any[]).map((r) => ({
        type: 'document',
        path: r.path,
        title: r.title,
        snippet: r.snippet || undefined,
        indexedAt: r.indexedAt,
        size: r.size,
        mime: r.mime,
      })) as LocalSearchResult[];
    } catch {
      const like = `%${query}%`;
      docs = (this.searchDocsLikeStmt.all(like, like) as any[]).map((r) => ({
        type: 'document',
        path: r.path,
        title: r.title,
        indexedAt: r.indexedAt,
        size: r.size,
        mime: r.mime,
      })) as LocalSearchResult[];
    }
    try {
      hist = (this.searchHistoryStmt.all(q) as any[]).map((r) => ({ type: 'history', url: r.url, title: r.title })) as LocalSearchResult[];
    } catch {
      const like = `%${query}%`;
      hist = (this.searchHistoryLikeStmt.all(like, like) as any[]).map((r) => ({ type: 'history', url: r.url, title: r.title })) as LocalSearchResult[];
    }
    return [...docs, ...hist];
  }
}
