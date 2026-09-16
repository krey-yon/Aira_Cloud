import { expect, test } from "bun:test";
import {
  defaultReleaseLocal,
  fromDatetimeLocal,
  toDatetimeLocal,
} from "./anime-time";

test("datetime-local round-trips through browser-local ISO", () => {
  const local = "2026-09-19T21:30";
  const iso = fromDatetimeLocal(local);
  expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/);
  expect(toDatetimeLocal(iso)).toBe(local);
});

test("defaultReleaseLocal is a datetime-local string about a week out", () => {
  const value = defaultReleaseLocal();
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  const ms = Date.parse(fromDatetimeLocal(value));
  expect(ms).toBeGreaterThan(Date.now() + 6 * 86_400_000);
});
