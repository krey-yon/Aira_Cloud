import { describe, expect, test } from "bun:test";

import { formatRelativeTime } from "./relative-time";

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 8, 6, 12, 0, 0);

  test("future units", () => {
    expect(formatRelativeTime(now + 5_000, now)).toBe("in 5 sec");
    expect(formatRelativeTime(now + 3 * 60_000, now)).toBe("in 3 min");
    expect(formatRelativeTime(now + 2 * 3_600_000, now)).toBe("in 2 hours");
    expect(formatRelativeTime(now + 3 * 86_400_000, now)).toBe("in 3 days");
  });

  test("past units", () => {
    expect(formatRelativeTime(now - 5_000, now)).toBe("5 sec ago");
    expect(formatRelativeTime(now - 3 * 60_000, now)).toBe("3 min ago");
    expect(formatRelativeTime(now - 1 * 3_600_000, now)).toBe("1 hour ago");
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe("2 days ago");
  });

  test("accepts ISO strings", () => {
    expect(formatRelativeTime(new Date(now + 90_000).toISOString(), now)).toBe("in 2 min");
  });
});
