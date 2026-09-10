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

  constructor(path: string) {
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
    return { id, title, markdown, createdAt };
  }

  get(id: string): CanvasRecord | null {
    const row = this.db
      .query(
        `SELECT id, title, markdown, created_at AS createdAt
         FROM canvases WHERE id = $id`,
      )
      .get({ $id: id }) as CanvasRecord | null;
    return row ?? null;
  }
}
