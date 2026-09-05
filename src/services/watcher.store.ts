import { Database } from "bun:sqlite";

import { config } from "../config";

export type WatcherStatus = "active" | "paused" | "fired" | "error";

export type WatcherRecord = {
  id: string;
  title: string;
  prompt: string;
  status: WatcherStatus;
  clientId?: string;
  skillId?: string;
  lastFiredAt?: number;
  lastNudge?: string;
  createdAt: number;
  updatedAt: number;
};

export type WatcherInput = {
  title: string;
  prompt: string;
  clientId?: string;
  skillId?: string;
  id?: string;
};

type WatcherRow = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  client_id: string | null;
  skill_id: string | null;
  last_fired_at: number | null;
  last_nudge: string | null;
  created_at: number;
  updated_at: number;
};

function newWatcherId() {
  return `watch_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function rowToWatcher(row: WatcherRow): WatcherRecord {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    status: row.status as WatcherStatus,
    clientId: row.client_id ?? undefined,
    skillId: row.skill_id ?? undefined,
    lastFiredAt: row.last_fired_at ?? undefined,
    lastNudge: row.last_nudge ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WatcherStore {
  private readonly db: Database;

  constructor(dbPath = config.watchersDbPath) {
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS watchers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL,
        client_id TEXT,
        skill_id TEXT,
        last_fired_at INTEGER,
        last_nudge TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_watchers_status ON watchers (status);
    `);
  }

  create(input: WatcherInput): WatcherRecord {
    const title = input.title.trim();
    const prompt = input.prompt.trim();
    if (!title) throw new Error("title is required");
    if (!prompt) throw new Error("prompt is required");
    const now = Date.now();
    const record: WatcherRecord = {
      id: input.id ?? newWatcherId(),
      title,
      prompt,
      status: "active",
      clientId: input.clientId,
      skillId: input.skillId,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .query(
        `INSERT INTO watchers
          (id, title, prompt, status, client_id, skill_id, last_fired_at, last_nudge, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      )
      .run(
        record.id,
        record.title,
        record.prompt,
        record.status,
        record.clientId ?? null,
        record.skillId ?? null,
        record.createdAt,
        record.updatedAt,
      );
    return record;
  }

  get(id: string): WatcherRecord | undefined {
    const row = this.db.query(`SELECT * FROM watchers WHERE id = ?`).get(id) as
      | WatcherRow
      | null;
    return row ? rowToWatcher(row) : undefined;
  }

  list(opts?: {
    status?: WatcherStatus;
    clientId?: string;
    limit?: number;
  }): WatcherRecord[] {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (opts?.status) {
      clauses.push("status = ?");
      params.push(opts.status);
    }
    if (opts?.clientId) {
      clauses.push("client_id = ?");
      params.push(opts.clientId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .query(
        `SELECT * FROM watchers ${where} ORDER BY updated_at DESC LIMIT ${limit}`,
      )
      .all(...params) as WatcherRow[];
    return rows.map(rowToWatcher);
  }

  update(
    id: string,
    patch: Partial<Pick<WatcherRecord, "title" | "prompt" | "status" | "clientId" | "skillId" | "lastFiredAt" | "lastNudge">>,
  ): WatcherRecord | undefined {
    const current = this.get(id);
    if (!current) return undefined;
    const next: WatcherRecord = {
      ...current,
      title: patch.title?.trim() || current.title,
      prompt: patch.prompt?.trim() || current.prompt,
      status: patch.status ?? current.status,
      clientId: patch.clientId !== undefined ? patch.clientId : current.clientId,
      skillId: patch.skillId !== undefined ? patch.skillId : current.skillId,
      lastFiredAt:
        patch.lastFiredAt !== undefined ? patch.lastFiredAt : current.lastFiredAt,
      lastNudge: patch.lastNudge !== undefined ? patch.lastNudge : current.lastNudge,
      updatedAt: Date.now(),
    };
    this.db
      .query(
        `UPDATE watchers SET
          title = ?, prompt = ?, status = ?, client_id = ?, skill_id = ?,
          last_fired_at = ?, last_nudge = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.title,
        next.prompt,
        next.status,
        next.clientId ?? null,
        next.skillId ?? null,
        next.lastFiredAt ?? null,
        next.lastNudge ?? null,
        next.updatedAt,
        id,
      );
    return next;
  }

  delete(id: string): boolean {
    const result = this.db.query(`DELETE FROM watchers WHERE id = ?`).run(id);
    return result.changes > 0;
  }
}

let singleton: WatcherStore | null = null;

export function getWatcherStore(): WatcherStore {
  if (!singleton) singleton = new WatcherStore();
  return singleton;
}
