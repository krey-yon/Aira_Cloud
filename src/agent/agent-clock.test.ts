import { expect, test } from "bun:test";

import { formatAgentClock } from "./agent-clock";

test("formatAgentClock includes UTC ISO and a local line", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");
  const text = formatAgentClock(now);
  expect(text).toContain("UTC: 2026-09-10T12:00:00.000Z");
  const localLine = text.split("\n").find((line) => line.startsWith("Local:"));
  expect(localLine !== undefined && localLine.length > "Local:".length).toBe(true);
});
