import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SchedulerService } from "./scheduler";
import { SqliteTaskStore } from "./store";
import { resolveRunAt } from "./types";

describe("resolveRunAt", () => {
  test("uses absolute ISO runAt", () => {
    const date = resolveRunAt({
      title: "t",
      prompt: "p",
      runAt: "2026-09-08T09:00:00+05:30",
    });
    expect(date.toISOString()).toBe(
      new Date("2026-09-08T09:00:00+05:30").toISOString(),
    );
  });

  test("uses relative delay", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const date = resolveRunAt({ title: "t", prompt: "p", delayMinutes: 30 }, now);
    expect(date.getTime()).toBe(now + 30 * 60_000);
  });

  test("rejects missing timing", () => {
    expect(() => resolveRunAt({ title: "t", prompt: "p" })).toThrow(/runAt|delay/);
  });
});

describe("SchedulerService", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeScheduler() {
    const dir = mkdtempSync(join(tmpdir(), "aira-sched-"));
    dirs.push(dir);
    return new SchedulerService(new SqliteTaskStore(join(dir, "scheduler.sqlite")));
  }

  test("schedules, lists, and cancels a pending task", async () => {
    const scheduler = makeScheduler();
    const task = await scheduler.schedule({
      title: "Monday email",
      prompt: "Email alice@example.com about the launch",
      delayMinutes: 60,
      clientId: "ext_test",
    });
    expect(task.status).toBe("pending");
    expect((await scheduler.list({ status: "pending" })).map((t) => t.id)).toContain(
      task.id,
    );

    const cancelled = await scheduler.cancel(task.id);
    expect(cancelled?.status).toBe("cancelled");
    expect(
      (await scheduler.list({ status: "pending" })).find((t) => t.id === task.id),
    ).toBeUndefined();
  });

  test("fires a due task through the executor", async () => {
    const scheduler = makeScheduler();
    let ran = "";
    scheduler.setExecutor(async (task) => {
      ran = task.prompt;
      return { result: "ok" };
    });

    const task = await scheduler.schedule({
      title: "Soon",
      prompt: "Say hello",
      delayMs: 1,
    });

    await Bun.sleep(5);
    await scheduler.tick();

    const done = await scheduler.get(task.id);
    expect(ran).toBe("Say hello");
    expect(done?.status).toBe("done");
    expect(done?.result).toBe("ok");
  });
});
