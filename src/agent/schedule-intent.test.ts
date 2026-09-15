import { describe, expect, test } from "bun:test";

import { scheduleTaskFailureReason, scheduleToolSucceeded, wantsSchedule } from "./schedule-intent";

describe("wantsSchedule", () => {
  test("matches remind, schedule, later, tomorrow, and relative delays", () => {
    expect(wantsSchedule("Remind me to email Alice")).toBe(true);
    expect(wantsSchedule("schedule this for Monday")).toBe(true);
    expect(wantsSchedule("do this later")).toBe(true);
    expect(wantsSchedule("ping me tomorrow")).toBe(true);
    expect(wantsSchedule("run this in 20 minutes")).toBe(true);
    expect(wantsSchedule("send it in 2 hours")).toBe(true);
    expect(wantsSchedule("follow up in 3 days")).toBe(true);
  });

  test("does not match unrelated text", () => {
    expect(wantsSchedule("what is photosynthesis")).toBe(false);
    expect(wantsSchedule("summarize this page")).toBe(false);
  });
});

describe("scheduleToolSucceeded", () => {
  test("is true for schedule_task with ok true as object or JSON", () => {
    expect(
      scheduleToolSucceeded([
        { name: "schedule_task", result: { ok: true, task: { id: "task_1" } } },
      ]),
    ).toBe(true);
    expect(
      scheduleToolSucceeded([
        {
          name: "schedule_task",
          result: JSON.stringify({ ok: true, task: { id: "task_1" } }),
        },
      ]),
    ).toBe(true);
  });

  test("is false when the tool is missing or not ok", () => {
    expect(scheduleToolSucceeded(undefined)).toBe(false);
    expect(scheduleToolSucceeded([])).toBe(false);
    expect(
      scheduleToolSucceeded([{ name: "websearch", result: { ok: true } }]),
    ).toBe(false);
    expect(
      scheduleToolSucceeded([
        { name: "schedule_task", result: { ok: false, error: "in the past" } },
      ]),
    ).toBe(false);
    expect(
      scheduleToolSucceeded([
        { name: "schedule_task", result: '{"ok":false,"error":"nope"}' },
      ]),
    ).toBe(false);
  });
});

describe("scheduleTaskFailureReason", () => {
  test("is null on success, surfaces tool error otherwise", () => {
    expect(
      scheduleTaskFailureReason([
        { name: "schedule_task", result: { ok: true, task: { id: "task_1" } } },
      ]),
    ).toBeNull();
    expect(scheduleTaskFailureReason(undefined)).toContain("not called");
    expect(scheduleTaskFailureReason([])).toContain("not called");
    expect(
      scheduleTaskFailureReason([
        { name: "schedule_task", result: { ok: false, error: "runAt is in the past" } },
      ]),
    ).toContain("in the past");
  });
});
