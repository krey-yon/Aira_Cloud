import { config } from "../config";
import { TaskStore } from "./store";
import {
  newTaskId,
  resolveRunAt,
  type ScheduleInput,
  type ScheduledTask,
  type ScheduledTaskStatus,
} from "./types";

export type TaskExecutor = (task: ScheduledTask) => Promise<{
  result?: string;
  error?: string;
}>;

export class SchedulerService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private executor: TaskExecutor | null = null;

  constructor(private readonly store = new TaskStore(config.schedulerDbPath)) {}

  setExecutor(executor: TaskExecutor) {
    this.executor = executor;
  }

  schedule(input: ScheduleInput): ScheduledTask {
    const title = input.title?.trim();
    const prompt = input.prompt?.trim();
    if (!title) throw new Error("title is required");
    if (!prompt) throw new Error("prompt is required");

    const runAt = resolveRunAt(input);
    const now = new Date().toISOString();
    const task: ScheduledTask = {
      id: input.id ?? newTaskId(),
      clientId: input.clientId,
      title,
      prompt,
      skillId: input.skillId,
      runAt: runAt.toISOString(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };
    return this.store.insert(task);
  }

  get(id: string): ScheduledTask | undefined {
    return this.store.get(id);
  }

  list(opts?: { status?: ScheduledTaskStatus; clientId?: string; limit?: number }) {
    return this.store.list(opts);
  }

  cancel(id: string): ScheduledTask | undefined {
    const task = this.store.get(id);
    if (!task) return undefined;
    if (task.status !== "pending") {
      throw new Error(`Cannot cancel task in status ${task.status}`);
    }
    return this.store.update(id, { status: "cancelled" });
  }

  /** Start the poll loop (safe to call once). */
  start(intervalMs = config.schedulerTickMs) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    // Don't keep the process alive solely for the timer in tests if needed —
    // in server mode we always want it.
    if (typeof this.timer === "object" && "unref" in this.timer) {
      // Keep referenced so Coolify process stays scheduled.
    }
    void this.tick();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const nowIso = new Date().toISOString();
      const due = this.store.due(nowIso);
      for (const task of due) {
        await this.runOne(task.id);
      }
    } finally {
      this.ticking = false;
    }
  }

  private async runOne(id: string) {
    const claimed = this.store.claim(id);
    if (!claimed) return;

    if (!this.executor) {
      this.store.update(id, {
        status: "error",
        error: "No task executor configured",
      });
      return;
    }

    try {
      const outcome = await this.executor(claimed);
      if (outcome.error) {
        this.store.update(id, {
          status: "error",
          error: outcome.error,
          result: outcome.result,
        });
        return;
      }
      this.store.update(id, {
        status: "done",
        result: outcome.result,
        error: undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.store.update(id, { status: "error", error: message });
    }
  }
}

let singleton: SchedulerService | null = null;

export function getScheduler(): SchedulerService {
  if (!singleton) singleton = new SchedulerService();
  return singleton;
}

export function resetSchedulerForTests() {
  singleton?.stop();
  singleton = null;
}
