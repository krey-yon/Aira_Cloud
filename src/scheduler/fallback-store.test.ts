import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ResilientTaskStore } from "./fallback-store";
import { SqliteTaskStore, type TaskStoreApi } from "./store";
import type { ScheduledTask } from "./types";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function task(id: string): ScheduledTask {
  const now = new Date().toISOString();
  return {
    id,
    title: `task ${id}`,
    prompt: "noop",
    runAt: new Date(Date.now() + 3_600_000).toISOString(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

function failingStore(calls: { count: number }): TaskStoreApi {
  const boom = async (): Promise<never> => {
    calls.count += 1;
    throw new Error("redis down");
  };
  return {
    insert: () => boom(),
    get: () => boom(),
    list: () => boom(),
    due: () => boom(),
    update: () => boom(),
    claim: () => boom(),
  };
}

test("falls back to sqlite when redis fails, then sticks to it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aira-fallback-"));
  dirs.push(dir);
  const fallback = new SqliteTaskStore(join(dir, "scheduler.sqlite"));
  await fallback.insert(task("task_1"));

  const calls = { count: 0 };
  const store = new ResilientTaskStore(failingStore(calls), fallback);

  const first = await store.list();
  expect(first.map((t) => t.id)).toEqual(["task_1"]);
  await store.list();
  // Primary tried once, then pinned — no per-request flapping.
  expect(calls.count).toBe(1);
});

test("healthy primary passes through without touching fallback", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aira-fallback-"));
  dirs.push(dir);
  const primary = new SqliteTaskStore(join(dir, "primary.sqlite"));
  await primary.insert(task("task_9"));
  const fallback = new SqliteTaskStore(join(dir, "fallback.sqlite"));

  const store = new ResilientTaskStore(primary, fallback);
  expect((await store.list()).map((t) => t.id)).toEqual(["task_9"]);
  expect(await fallback.list()).toEqual([]);
});
