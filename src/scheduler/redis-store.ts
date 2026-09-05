import { RedisClient } from "bun";

import { config } from "../config";
import type { TaskStoreApi } from "./store";
import type { ScheduledTask, ScheduledTaskStatus } from "./types";

const KEY_PREFIX = "schedule:";
const INDEX_KEY = "schedule:index";
const INDEX_CAP = 500;

function taskKey(id: string) {
  return `${KEY_PREFIX}${id}`;
}

export class RedisTaskStore implements TaskStoreApi {
  private client: RedisClient | null = null;

  private redis(): RedisClient {
    if (!this.client) {
      this.client = config.redisUrl
        ? new RedisClient(config.redisUrl)
        : new RedisClient();
    }
    return this.client;
  }

  private async readIndex(): Promise<string[]> {
    try {
      const raw = await this.redis().get(INDEX_KEY);
      if (!raw) return [];
      const ids = JSON.parse(raw) as string[];
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(ids: string[]) {
    await this.redis().set(INDEX_KEY, JSON.stringify(ids.slice(0, INDEX_CAP)));
  }

  private async pushIndex(id: string) {
    const ids = await this.readIndex();
    await this.writeIndex([id, ...ids.filter((x) => x !== id)]);
  }

  private async saveTask(task: ScheduledTask) {
    await this.redis().set(taskKey(task.id), JSON.stringify(task));
  }

  async insert(task: ScheduledTask): Promise<ScheduledTask> {
    await this.saveTask(task);
    await this.pushIndex(task.id);
    return task;
  }

  async get(id: string): Promise<ScheduledTask | undefined> {
    const raw = await this.redis().get(taskKey(id));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as ScheduledTask;
    } catch {
      return undefined;
    }
  }

  async list(opts?: {
    status?: ScheduledTaskStatus;
    clientId?: string;
    limit?: number;
  }): Promise<ScheduledTask[]> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const ids = await this.readIndex();
    const tasks: ScheduledTask[] = [];
    for (const id of ids) {
      const task = await this.get(id);
      if (!task) continue;
      if (opts?.status && task.status !== opts.status) continue;
      if (opts?.clientId && task.clientId !== opts.clientId) continue;
      tasks.push(task);
    }
    tasks.sort((a, b) => a.runAt.localeCompare(b.runAt));
    return tasks.slice(0, limit);
  }

  async due(nowIso: string, limit = 20): Promise<ScheduledTask[]> {
    const capped = Math.min(Math.max(limit, 1), 200);
    const ids = await this.readIndex();
    const tasks: ScheduledTask[] = [];
    for (const id of ids) {
      const task = await this.get(id);
      if (!task) continue;
      if (task.status !== "pending") continue;
      if (task.runAt > nowIso) continue;
      tasks.push(task);
    }
    tasks.sort((a, b) => a.runAt.localeCompare(b.runAt));
    return tasks.slice(0, capped);
  }

  async update(
    id: string,
    patch: Partial<
      Pick<ScheduledTask, "status" | "result" | "error" | "runAt" | "title" | "prompt" | "metadata">
    >,
  ): Promise<ScheduledTask | undefined> {
    const current = await this.get(id);
    if (!current) return undefined;
    const next: ScheduledTask = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.saveTask(next);
    return next;
  }

  async claim(id: string): Promise<ScheduledTask | undefined> {
    const current = await this.get(id);
    if (!current || current.status !== "pending") return undefined;
    const next: ScheduledTask = {
      ...current,
      status: "running",
      updatedAt: new Date().toISOString(),
    };
    await this.saveTask(next);
    return next;
  }
}
