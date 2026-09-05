import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { config } from "../config";

export type NotifyStatus = "pending" | "delivered" | "skipped" | "failed";

export type NotifyEvent = {
  id: string;
  watcherId?: string;
  clientId?: string;
  title: string;
  body: string;
  status: NotifyStatus;
  emailSent: boolean;
  widgetSent: boolean;
  createdAt: number;
  deliveredAt?: number;
  error?: string;
};

type Row = {
  id: string;
  watcher_id: string | null;
  client_id: string | null;
  title: string;
  body: string;
  status: string;
  email_sent: number;
  widget_sent: number;
  created_at: number;
  delivered_at: number | null;
  error: string | null;
};

function newId() {
  return `nq_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function toEvent(row: Row): NotifyEvent {
  return {
    id: row.id,
    watcherId: row.watcher_id ?? undefined,
    clientId: row.client_id ?? undefined,
    title: row.title,
    body: row.body,
    status: row.status as NotifyStatus,
    emailSent: Boolean(row.email_sent),
    widgetSent: Boolean(row.widget_sent),
    createdAt: row.created_at,
    deliveredAt: row.delivered_at ?? undefined,
    error: row.error ?? undefined,
  };
}

export class NotifyQueue {
  private readonly db: Database;

  constructor(dbPath = config.notifyDbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notify_events (
        id TEXT PRIMARY KEY,
        watcher_id TEXT,
        client_id TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL,
        email_sent INTEGER NOT NULL DEFAULT 0,
        widget_sent INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        delivered_at INTEGER,
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_notify_status ON notify_events (status, created_at);
    `);
  }

  enqueue(input: {
    title: string;
    body: string;
    watcherId?: string;
    clientId?: string;
  }): NotifyEvent {
    const now = Date.now();
    const event: NotifyEvent = {
      id: newId(),
      title: input.title.trim() || "Aira watcher",
      body: input.body.trim() || "Condition met.",
      watcherId: input.watcherId,
      clientId: input.clientId,
      status: "pending",
      emailSent: false,
      widgetSent: false,
      createdAt: now,
    };
    this.db
      .query(
        `INSERT INTO notify_events
          (id, watcher_id, client_id, title, body, status, email_sent, widget_sent, created_at, delivered_at, error)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, NULL)`,
      )
      .run(
        event.id,
        event.watcherId ?? null,
        event.clientId ?? null,
        event.title,
        event.body,
        event.status,
        event.createdAt,
      );
    return event;
  }

  list(opts?: { status?: NotifyStatus; limit?: number }): NotifyEvent[] {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    if (opts?.status) {
      const rows = this.db
        .query(
          `SELECT * FROM notify_events WHERE status = ? ORDER BY created_at DESC LIMIT ${limit}`,
        )
        .all(opts.status) as Row[];
      return rows.map(toEvent);
    }
    const rows = this.db
      .query(`SELECT * FROM notify_events ORDER BY created_at DESC LIMIT ${limit}`)
      .all() as Row[];
    return rows.map(toEvent);
  }

  pending(limit = 20): NotifyEvent[] {
    const rows = this.db
      .query(
        `SELECT * FROM notify_events WHERE status = 'pending' ORDER BY created_at ASC LIMIT ${limit}`,
      )
      .all() as Row[];
    return rows.map(toEvent);
  }

  update(
    id: string,
    patch: Partial<Pick<NotifyEvent, "status" | "emailSent" | "widgetSent" | "deliveredAt" | "error">>,
  ): NotifyEvent | undefined {
    const current = this.get(id);
    if (!current) return undefined;
    const next: NotifyEvent = {
      ...current,
      status: patch.status ?? current.status,
      emailSent: patch.emailSent ?? current.emailSent,
      widgetSent: patch.widgetSent ?? current.widgetSent,
      deliveredAt: patch.deliveredAt ?? current.deliveredAt,
      error: patch.error !== undefined ? patch.error : current.error,
    };
    this.db
      .query(
        `UPDATE notify_events SET
          status = ?, email_sent = ?, widget_sent = ?, delivered_at = ?, error = ?
         WHERE id = ?`,
      )
      .run(
        next.status,
        next.emailSent ? 1 : 0,
        next.widgetSent ? 1 : 0,
        next.deliveredAt ?? null,
        next.error ?? null,
        id,
      );
    return next;
  }

  get(id: string): NotifyEvent | undefined {
    const row = this.db.query(`SELECT * FROM notify_events WHERE id = ?`).get(id) as
      | Row
      | null;
    return row ? toEvent(row) : undefined;
  }
}

let singleton: NotifyQueue | null = null;

export function getNotifyQueue(): NotifyQueue {
  if (!singleton) singleton = new NotifyQueue();
  return singleton;
}
