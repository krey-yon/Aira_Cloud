import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { newCanvasId } from "../shared/agent";
import { config } from "../config";

export type CanvasRecord = {
  id: string;
  title: string;
  markdown: string;
  createdAt: string;
};

let singleton: CanvasStore | null = null;

export function getCanvasStore(): CanvasStore {
  if (!singleton) singleton = new CanvasStore(config.canvasDbPath);
  return singleton;
}

export class CanvasStore {
  private readonly db: Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
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
