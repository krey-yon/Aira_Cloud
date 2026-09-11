import { config } from "../config";
import { RedisTaskStore } from "./redis-store";
import { SqliteTaskStore, type TaskStoreApi } from "./store";
import type { ScheduledTask, ScheduledTaskStatus } from "./types";

/**
 * Redis primary with sticky SQLite fallback. The first Redis failure pins the
 * fallback for process lifetime: no per-request flapping, no dual-store
 * split-brain on writes. Tasks written during an outage stay in SQLite.
 */
export class ResilientTaskStore implements TaskStoreApi {
  private fallback: TaskStoreApi | null = null;
  private pinned = false;

  constructor(
    private readonly primary: TaskStoreApi = new RedisTaskStore(),
    fallback?: TaskStoreApi,
  ) {
    if (fallback) {
      this.fallback = fallback;
    }
  }

  private store(): TaskStoreApi {
    if (this.pinned) return this.fallback!;
    return this.primary;
  }

  private pin(err: unknown): TaskStoreApi {
    if (!this.pinned) {
      console.error(
        "[scheduler] redis unavailable, pinned to sqlite fallback",
        err instanceof Error ? err.message : err,
      );
      if (!this.fallback) {
        this.fallback = new SqliteTaskStore(config.schedulerDbPath);
      }
      this.pinned = true;
    }
    return this.fallback!;
  }

  private async run<T>(fn: (store: TaskStoreApi) => Promise<T>): Promise<T> {
    try {
      return await fn(this.store());
    } catch (err) {
      return fn(this.pin(err));
    }
  }

  insert(task: ScheduledTask): Promise<ScheduledTask> {
    return this.run((s) => s.insert(task));
  }

  get(id: string): Promise<ScheduledTask | undefined> {
    return this.run((s) => s.get(id));
  }

  list(opts?: { status?: ScheduledTaskStatus; clientId?: string; limit?: number }) {
    return this.run((s) => s.list(opts));
  }

  due(nowIso: string, limit?: number) {
    return this.run((s) => s.due(nowIso, limit));
  }

  update(
    id: string,
    patch: Partial<
      Pick<ScheduledTask, "status" | "result" | "error" | "runAt" | "title" | "prompt" | "metadata">
    >,
  ) {
    return this.run((s) => s.update(id, patch));
  }

  claim(id: string) {
    return this.run((s) => s.claim(id));
  }
}
