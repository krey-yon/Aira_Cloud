import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { ScheduledTask, ScheduledTaskStatus } from "./types";

function rowToTask(row: Record<string, unknown>): ScheduledTask {
  return {
    id: String(row.id),
    clientId: row.client_id ? String(row.client_id) : undefined,
    title: String(row.title),
    prompt: String(row.prompt),
    skillId: row.skill_id ? String(row.skill_id) : undefined,
    runAt: String(row.run_at),
    status: String(row.status) as ScheduledTaskStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    result: row.result != null ? String(row.result) : undefined,
    error: row.error != null ? String(row.error) : undefined,
    metadata: row.metadata ? (JSON.parse(String(row.metadata)) as Record<string, unknown>) : undefined,
  };
}

export class TaskStore {
  private readonly db: Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        client_id TEXT,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        skill_id TEXT,
        run_at TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        result TEXT,
        error TEXT,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due
        ON scheduled_tasks (status, run_at);
    `);
  }

  insert(task: ScheduledTask): ScheduledTask {
    this.db
      .query(
        `INSERT INTO scheduled_tasks
          (id, client_id, title, prompt, skill_id, run_at, status, created_at, updated_at, result, error, metadata)
         VALUES
          ($id, $client_id, $title, $prompt, $skill_id, $run_at, $status, $created_at, $updated_at, $result, $error, $metadata)`,
      )
      .run({
        $id: task.id,
        $client_id: task.clientId ?? null,
        $title: task.title,
        $prompt: task.prompt,
        $skill_id: task.skillId ?? null,
        $run_at: task.runAt,
        $status: task.status,
        $created_at: task.createdAt,
        $updated_at: task.updatedAt,
        $result: task.result ?? null,
        $error: task.error ?? null,
        $metadata: task.metadata ? JSON.stringify(task.metadata) : null,
      });
    return task;
  }

  get(id: string): ScheduledTask | undefined {
    const row = this.db.query(`SELECT * FROM scheduled_tasks WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | null;
    return row ? rowToTask(row) : undefined;
  }

  list(opts?: { status?: ScheduledTaskStatus; clientId?: string; limit?: number }): ScheduledTask[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts?.status) {
      clauses.push("status = ?");
      params.push(opts.status);
    }
    if (opts?.clientId) {
      clauses.push("client_id = ?");
      params.push(opts.clientId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const rows = this.db
      .query(
        `SELECT * FROM scheduled_tasks ${where} ORDER BY run_at ASC LIMIT ${limit}`,
      )
      .all(...params) as Record<string, unknown>[];
    return rows.map(rowToTask);
  }

  /** Pending tasks whose run_at is <= nowIso */
  due(nowIso: string, limit = 20): ScheduledTask[] {
    const rows = this.db
      .query(
        `SELECT * FROM scheduled_tasks
         WHERE status = 'pending' AND run_at <= ?
         ORDER BY run_at ASC
         LIMIT ?`,
      )
      .all(nowIso, limit) as Record<string, unknown>[];
    return rows.map(rowToTask);
  }

  update(
    id: string,
    patch: Partial<
      Pick<ScheduledTask, "status" | "result" | "error" | "runAt" | "title" | "prompt" | "metadata">
    >,
  ): ScheduledTask | undefined {
    const current = this.get(id);
    if (!current) return undefined;
    const next: ScheduledTask = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .query(
        `UPDATE scheduled_tasks SET
          title = $title,
          prompt = $prompt,
          run_at = $run_at,
          status = $status,
          updated_at = $updated_at,
          result = $result,
          error = $error,
          metadata = $metadata
         WHERE id = $id`,
      )
      .run({
        $id: next.id,
        $title: next.title,
        $prompt: next.prompt,
        $run_at: next.runAt,
        $status: next.status,
        $updated_at: next.updatedAt,
        $result: next.result ?? null,
        $error: next.error ?? null,
        $metadata: next.metadata ? JSON.stringify(next.metadata) : null,
      });
    return next;
  }

  /** Atomically claim a pending due task for execution. */
  claim(id: string): ScheduledTask | undefined {
    const updatedAt = new Date().toISOString();
    const result = this.db
      .query(
        `UPDATE scheduled_tasks
         SET status = 'running', updated_at = $updated_at
         WHERE id = $id AND status = 'pending'
         RETURNING *`,
      )
      .get({ $id: id, $updated_at: updatedAt }) as Record<string, unknown> | null;
    return result ? rowToTask(result) : undefined;
  }
}
