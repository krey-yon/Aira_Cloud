import { Database } from "bun:sqlite";

import { newCanvasId } from "../shared/agent";
import { config } from "../config";
import { createSingleton, openSqlite } from "../persist/sqlite";

export type CanvasRecord = {
  id: string;
  title: string;
  markdown: string;
  createdAt: string;
};

const canvasStore = createSingleton(() => new CanvasStore(config.canvasDbPath));

export function getCanvasStore(): CanvasStore {
  return canvasStore.get();
}

export class CanvasStore {
  private readonly db: Database;

  constructor(
    path: string,
    private readonly ttlMs = config.canvasTtlMs,
  ) {
    this.db = openSqlite(path, { wal: false });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS canvases (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        markdown TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  private expired(createdAt: string, now = Date.now()): boolean {
    const created = Date.parse(createdAt);
    return Number.isFinite(created) && now - created > this.ttlMs;
  }

  /** Delete rows older than the TTL. Runs on put so the table can't grow forever. */
  prune(now = Date.now()): number {
    const cutoff = new Date(now - this.ttlMs).toISOString();
    const result = this.db
      .query(`DELETE FROM canvases WHERE created_at < $cutoff`)
      .run({ $cutoff: cutoff });
    return Number(result.changes ?? 0);
  }

  put(input: { markdown: string; title?: string; id?: string }): CanvasRecord {
    const id = input.id || newCanvasId();
    const title = (input.title || "Aira answer").trim() || "Aira answer";
    const markdown = input.markdown;
    const createdAt = new Date().toISOString();
    this.db
      .query(
        `INSERT INTO canvases (id, title, markdown, created_at)
         VALUES ($id, $title, $markdown, $createdAt)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           markdown = excluded.markdown`,
      )
      .run({
        $id: id,
        $title: title,
        $markdown: markdown,
        $createdAt: createdAt,
      });
    this.prune();
    return { id, title, markdown, createdAt };
  }

  get(id: string): CanvasRecord | null {    const row = this.db
      .query(
        `SELECT id, title, markdown, created_at AS createdAt
         FROM canvases WHERE id = $id`,
      )
      .get({ $id: id }) as CanvasRecord | null;
    if (!row) return null;
    // ponytail: lazy expiry — expired links 404 via the /r/:id handler, prune on put bounds table size
    if (this.expired(row.createdAt)) {
      this.db.query(`DELETE FROM canvases WHERE id = $id`).run({ $id: id });
      return null;
    }
    return row;
  }

  /** Live canvases, newest first. Prunes expired rows so this is exactly "yet to be deleted". */
  list(limit = 10): CanvasRecord[] {
    this.prune();
    const safe = Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.floor(limit))) : 10;
    return this.db
      .query(
        `SELECT id, title, markdown, created_at AS createdAt
         FROM canvases ORDER BY created_at DESC, rowid DESC LIMIT $limit`,
      )
      .all({ $limit: safe }) as CanvasRecord[];
  }
}
