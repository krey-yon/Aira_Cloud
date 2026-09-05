import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { config } from "../config";
import type { ConditionOp } from "./watcher.condition";

export type WatcherStatus = "active" | "paused" | "fired" | "error";

export type WatcherRecord = {
  id: string;
  title: string;
  prompt: string;
  resourceUrl: string;
  conditionPath: string;
  conditionOp: ConditionOp;
  conditionValue: string;
  intervalMinutes: number;
  notifyEmail: boolean;
  notifyWidget: boolean;
  status: WatcherStatus;
  clientId?: string;
  skillId?: string;
  nextCheckAt: number;
  lastCheckedAt?: number;
  lastValue?: string;
  lastError?: string;
  lastFiredAt?: number;
  lastNudge?: string;
  createdAt: number;
  updatedAt: number;
};

export type WatcherInput = {
  title: string;
  prompt?: string;
  resourceUrl: string;
  conditionPath: string;
  conditionOp?: ConditionOp;
  conditionValue?: string;
  intervalMinutes?: number;
  notifyEmail?: boolean;
  notifyWidget?: boolean;
  clientId?: string;
  skillId?: string;
  id?: string;
};

type WatcherRow = {
  id: string;
  title: string;
  prompt: string;
  resource_url: string;
  condition_path: string;
  condition_op: string;
  condition_value: string;
  interval_minutes: number;
  notify_email: number;
  notify_widget: number;
  status: string;
  client_id: string | null;
  skill_id: string | null;
  next_check_at: number;
  last_checked_at: number | null;
  last_value: string | null;
  last_error: string | null;
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
    resourceUrl: row.resource_url,
    conditionPath: row.condition_path,
    conditionOp: row.condition_op as ConditionOp,
    conditionValue: row.condition_value,
    intervalMinutes: row.interval_minutes,
    notifyEmail: Boolean(row.notify_email),
    notifyWidget: Boolean(row.notify_widget),
    status: row.status as WatcherStatus,
    clientId: row.client_id ?? undefined,
    skillId: row.skill_id ?? undefined,
    nextCheckAt: row.next_check_at,
    lastCheckedAt: row.last_checked_at ?? undefined,
    lastValue: row.last_value ?? undefined,
    lastError: row.last_error ?? undefined,
    lastFiredAt: row.last_fired_at ?? undefined,
    lastNudge: row.last_nudge ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureColumn(db: Database, name: string, ddl: string) {
  const cols = db.query(`PRAGMA table_info(watchers)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE watchers ADD COLUMN ${ddl}`);
  }
}

export class WatcherStore {
  private readonly db: Database;

  constructor(dbPath = config.watchersDbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
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
    ensureColumn(this.db, "resource_url", "resource_url TEXT NOT NULL DEFAULT ''");
    ensureColumn(this.db, "condition_path", "condition_path TEXT NOT NULL DEFAULT ''");
    ensureColumn(this.db, "condition_op", "condition_op TEXT NOT NULL DEFAULT 'truthy'");
    ensureColumn(this.db, "condition_value", "condition_value TEXT NOT NULL DEFAULT ''");
    ensureColumn(this.db, "interval_minutes", "interval_minutes INTEGER NOT NULL DEFAULT 5");
    ensureColumn(this.db, "notify_email", "notify_email INTEGER NOT NULL DEFAULT 1");
    ensureColumn(this.db, "notify_widget", "notify_widget INTEGER NOT NULL DEFAULT 1");
    ensureColumn(this.db, "next_check_at", "next_check_at INTEGER NOT NULL DEFAULT 0");
    ensureColumn(this.db, "last_checked_at", "last_checked_at INTEGER");
    ensureColumn(this.db, "last_value", "last_value TEXT");
    ensureColumn(this.db, "last_error", "last_error TEXT");
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_watchers_next ON watchers (next_check_at);`);
  }

  create(input: WatcherInput): WatcherRecord {
    const title = input.title.trim();
    const resourceUrl = input.resourceUrl.trim();
    const conditionPath = input.conditionPath.trim();
    if (!title) throw new Error("title is required");
    if (!resourceUrl) throw new Error("resourceUrl is required");
    if (!conditionPath) throw new Error("conditionPath is required");
    try {
      // eslint-disable-next-line no-new
      new URL(resourceUrl);
    } catch {
      throw new Error("resourceUrl must be a valid URL");
    }
    const intervalMinutes = Math.max(1, Math.min(input.intervalMinutes ?? 5, 24 * 60));
    const now = Date.now();
    const prompt =
      input.prompt?.trim() ||
      `Watch ${resourceUrl} until ${conditionPath} ${input.conditionOp ?? "truthy"}${
        input.conditionValue ? ` ${input.conditionValue}` : ""
      }`;
    const record: WatcherRecord = {
      id: input.id ?? newWatcherId(),
      title,
      prompt,
      resourceUrl,
      conditionPath,
      conditionOp: input.conditionOp ?? "truthy",
      conditionValue: input.conditionValue?.trim() ?? "",
      intervalMinutes,
      notifyEmail: input.notifyEmail !== false,
      notifyWidget: input.notifyWidget !== false,
      status: "active",
      clientId: input.clientId,
      skillId: input.skillId,
      nextCheckAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .query(
        `INSERT INTO watchers (
          id, title, prompt, resource_url, condition_path, condition_op, condition_value,
          interval_minutes, notify_email, notify_widget, status, client_id, skill_id,
          next_check_at, last_checked_at, last_value, last_error, last_fired_at, last_nudge,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
      )
      .run(
        record.id,
        record.title,
        record.prompt,
        record.resourceUrl,
        record.conditionPath,
        record.conditionOp,
        record.conditionValue,
        record.intervalMinutes,
        record.notifyEmail ? 1 : 0,
        record.notifyWidget ? 1 : 0,
        record.status,
        record.clientId ?? null,
        record.skillId ?? null,
        record.nextCheckAt,
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

  due(now = Date.now()): WatcherRecord[] {
    const rows = this.db
      .query(
        `SELECT * FROM watchers
         WHERE status = 'active' AND next_check_at <= ?
         ORDER BY next_check_at ASC
         LIMIT 20`,
      )
      .all(now) as WatcherRow[];
    return rows.map(rowToWatcher);
  }

  update(
    id: string,
    patch: Partial<
      Pick<
        WatcherRecord,
        | "title"
        | "prompt"
        | "resourceUrl"
        | "conditionPath"
        | "conditionOp"
        | "conditionValue"
        | "intervalMinutes"
        | "notifyEmail"
        | "notifyWidget"
        | "status"
        | "clientId"
        | "skillId"
        | "nextCheckAt"
        | "lastCheckedAt"
        | "lastValue"
        | "lastError"
        | "lastFiredAt"
        | "lastNudge"
      >
    >,
  ): WatcherRecord | undefined {
    const current = this.get(id);
    if (!current) return undefined;
    const next: WatcherRecord = {
      ...current,
      title: patch.title?.trim() || current.title,
      prompt: patch.prompt?.trim() || current.prompt,
      resourceUrl: patch.resourceUrl?.trim() || current.resourceUrl,
      conditionPath: patch.conditionPath?.trim() || current.conditionPath,
      conditionOp: patch.conditionOp ?? current.conditionOp,
      conditionValue:
        patch.conditionValue !== undefined
          ? patch.conditionValue.trim()
          : current.conditionValue,
      intervalMinutes: patch.intervalMinutes ?? current.intervalMinutes,
      notifyEmail:
        patch.notifyEmail !== undefined ? patch.notifyEmail : current.notifyEmail,
      notifyWidget:
        patch.notifyWidget !== undefined ? patch.notifyWidget : current.notifyWidget,
      status: patch.status ?? current.status,
      clientId: patch.clientId !== undefined ? patch.clientId : current.clientId,
      skillId: patch.skillId !== undefined ? patch.skillId : current.skillId,
      nextCheckAt: patch.nextCheckAt ?? current.nextCheckAt,
      lastCheckedAt:
        patch.lastCheckedAt !== undefined ? patch.lastCheckedAt : current.lastCheckedAt,
      lastValue: patch.lastValue !== undefined ? patch.lastValue : current.lastValue,
      lastError: patch.lastError !== undefined ? patch.lastError : current.lastError,
      lastFiredAt:
        patch.lastFiredAt !== undefined ? patch.lastFiredAt : current.lastFiredAt,
      lastNudge: patch.lastNudge !== undefined ? patch.lastNudge : current.lastNudge,
      updatedAt: Date.now(),
    };
    this.db
      .query(
        `UPDATE watchers SET
          title = ?, prompt = ?, resource_url = ?, condition_path = ?, condition_op = ?,
          condition_value = ?, interval_minutes = ?, notify_email = ?, notify_widget = ?,
          status = ?, client_id = ?, skill_id = ?, next_check_at = ?, last_checked_at = ?,
          last_value = ?, last_error = ?, last_fired_at = ?, last_nudge = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.title,
        next.prompt,
        next.resourceUrl,
        next.conditionPath,
        next.conditionOp,
        next.conditionValue,
        next.intervalMinutes,
        next.notifyEmail ? 1 : 0,
        next.notifyWidget ? 1 : 0,
        next.status,
        next.clientId ?? null,
        next.skillId ?? null,
        next.nextCheckAt,
        next.lastCheckedAt ?? null,
        next.lastValue ?? null,
        next.lastError ?? null,
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
