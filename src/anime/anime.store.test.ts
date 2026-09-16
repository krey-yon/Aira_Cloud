import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildAnimeEmailHtml } from "../mail/templates";
import { loadBundledSkillSeeds } from "../skills/seed";
import { tools } from "../tools";
import {
  advanceWeeklySchedule,
  applyFireSuccess,
  parseReleaseAt,
  RETRY_AFTER_MS,
} from "./anime.schedule";
import { AnimeRunner } from "./anime.runner";
import { AnimeStore } from "./anime.store";

const WEEK_MS = 7 * 86_400_000;
const COVER = "https://cdn.example.com/cover.jpg";

function tempStore() {
  const dir = mkdtempSync(join(tmpdir(), "aira-anime-"));
  const store = new AnimeStore(join(dir, "anime.sqlite"));
  return { dir, store };
}

test("parseReleaseAt trusts an explicit offset and fills Kolkata when missing", () => {
  expect(parseReleaseAt("2026-09-16T21:30:00+05:30")).toBe(
    Date.parse("2026-09-16T16:00:00.000Z"),
  );
  expect(parseReleaseAt("2026-09-16T21:30:00")).toBe(
    Date.parse("2026-09-16T16:00:00.000Z"),
  );
  expect(parseReleaseAt("2026-09-16T21:30:00Z")).toBe(
    Date.parse("2026-09-16T21:30:00.000Z"),
  );
  expect(parseReleaseAt("2026-09-16")).toBe(Date.parse("2026-09-15T18:30:00.000Z"));
});

test("parseReleaseAt rejects empty and garbage timestamps", () => {
  expect(() => parseReleaseAt("")).toThrow("releaseAt is required");
  expect(() => parseReleaseAt("next tuesday")).toThrow("ISO 8601");
});

test("advanceWeeklySchedule adds one week then catch-up skips leftover past slots", () => {
  const t = 1_000_000_000_000;
  expect(advanceWeeklySchedule(t, 7, t)).toBe(t + WEEK_MS);
  expect(advanceWeeklySchedule(t, 7, t + 3 * WEEK_MS)).toBe(t + 4 * WEEK_MS);
});

test("applyFireSuccess increments episode once and moves the schedule past now", () => {
  const t = 1_000_000_000_000;
  const now = t + 3 * WEEK_MS;
  const next = applyFireSuccess(
    { episode: 5, nextReleaseAt: t, recurrenceDays: 7 },
    now,
  );
  expect(next.episode).toBe(6);
  expect(next.nextReleaseAt).toBe(t + 4 * WEEK_MS);
  expect(next.lastNotifiedAt).toBe(now);
  expect(next.lastError).toBeUndefined();
  expect(next.status).toBe("active");
});

test("create list update delete and due follow the calendar record", () => {
  const { dir, store } = tempStore();
  try {
    const past = new Date(Date.now() - 2_000).toISOString();
    const created = store.create({
      title: " Frieren ",
      imageUrl: COVER,
      releaseAt: past,
      kind: "anime",
      episode: 3,
      clientId: "ext_1",
    });
    expect(created.id.startsWith("anime_")).toBe(true);
    expect(created.id.length).toBe(18);
    expect(created.title).toBe("Frieren");
    expect(created.kind).toBe("anime");
    expect(created.episode).toBe(3);
    expect(created.recurrenceDays).toBe(7);
    expect(created.status).toBe("active");
    expect(created.nextReleaseAt).toBeLessThanOrEqual(Date.now());

    expect(store.list().map((row) => row.id)).toEqual([created.id]);
    expect(store.list({ status: "paused" })).toEqual([]);
    expect(store.get(created.id)?.title).toBe("Frieren");

    const paused = store.update(created.id, { status: "paused", title: "Frieren: Beyond" });
    expect(paused?.title).toBe("Frieren: Beyond");
    expect(paused?.status).toBe("paused");
    expect(store.due()).toEqual([]);

    store.update(created.id, { status: "active" });
    expect(store.due().map((row) => row.id)).toEqual([created.id]);

    expect(store.delete(created.id)).toBe(true);
    expect(store.get(created.id)).toBeUndefined();
    expect(store.delete(created.id)).toBe(false);
    expect(store.due()).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("due skips a failed send for 5 minutes then retries the same episode", () => {
  const { dir, store } = tempStore();
  try {
    const created = store.create({
      title: "Solo Leveling",
      imageUrl: COVER,
      releaseAt: new Date(Date.now() - 1_000).toISOString(),
      kind: "manhwa",
    });
    expect(created.episode).toBe(1);
    expect(store.due().map((row) => row.id)).toEqual([created.id]);

    const now = Date.now();
    store.update(created.id, {
      lastError: "Resend 500",
      lastAttemptAt: now,
    });
    expect(store.due(now)).toEqual([]);
    expect(store.due(now + RETRY_AFTER_MS + 1).map((row) => row.id)).toEqual([
      created.id,
    ]);
    expect(store.get(created.id)?.episode).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runner sends once on catch-up, advances weekly, and delays retries without incrementing", async () => {
  const { dir, store } = tempStore();
  try {
    const t = Date.now() - 3 * WEEK_MS;
    const created = store.create({
      title: "Dandadan",
      imageUrl: COVER,
      releaseAt: new Date(t).toISOString(),
      episode: 5,
    });
    let calls = 0;
    const runner = new AnimeRunner(store, async () => {
      calls += 1;
      if (calls === 1) return { ok: false, error: "Resend down" };
      return { ok: true, id: "mail_1" };
    });

    await runner.tick();
    const afterFail = store.get(created.id)!;
    expect(calls).toBe(1);
    expect(afterFail.episode).toBe(5);
    expect(afterFail.lastError).toBe("Resend down");
    expect(afterFail.status).toBe("active");
    expect(store.due()).toEqual([]);

    afterFail.lastAttemptAt = Date.now() - RETRY_AFTER_MS - 1;
    store.update(created.id, { lastAttemptAt: afterFail.lastAttemptAt });
    await runner.tick();
    const afterOk = store.get(created.id)!;
    expect(calls).toBe(2);
    expect(afterOk.episode).toBe(6);
    expect(afterOk.lastError).toBeUndefined();
    expect(afterOk.nextReleaseAt).toBeGreaterThan(Date.now());
    expect(store.due()).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("anime email html includes the cover, title, and kind-aware copy", () => {
  const html = buildAnimeEmailHtml({
    title: "Frieren <S1>",
    imageUrl: "https://cdn.example.com/frieren.png?x=1&y=2",
    kind: "anime",
    episode: 12,
    consoleUrl: "https://aira.kreyon.in",
  });
  expect(html).toContain("Frieren &lt;S1&gt;");
  expect(html).toContain('src="https://cdn.example.com/frieren.png?x=1&amp;y=2"');
  expect(html).toContain("Episode 12 is out");
  expect(html).toContain("Open Aira console");
  expect(html).toContain("https://aira.kreyon.in");

  const manhwa = buildAnimeEmailHtml({
    title: "Solo Leveling",
    imageUrl: COVER,
    kind: "manhwa",
    episode: 4,
  });
  expect(manhwa).toContain("Chapter 4 is out");
});

test("anime tracker tools are registered and seeded on general-assistant", async () => {
  const names = [
    "create_anime_tracker",
    "list_anime_trackers",
    "update_anime_tracker",
    "delete_anime_tracker",
  ];
  for (const name of names) {
    expect(name in tools).toBe(true);
  }
  const packs = await loadBundledSkillSeeds();
  const general = packs.find((pack) => pack.id === "general-assistant");
  expect(general).toBeDefined();
  for (const name of names) {
    expect(general!.tools).toContain(name);
  }
});
