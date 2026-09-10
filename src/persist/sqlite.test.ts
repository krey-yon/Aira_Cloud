import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSingleton, openSqlite } from "./sqlite";

test("openSqlite creates parent dirs and enables WAL by default", () => {
  const dir = mkdtempSync(join(tmpdir(), "aira-sqlite-"));
  const path = join(dir, "nested", "db.sqlite");
  try {
    const db = openSqlite(path);
    const mode = db.query("PRAGMA journal_mode;").get() as { journal_mode: string };
    expect(mode.journal_mode.toLowerCase()).toBe("wal");
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("createSingleton returns the same instance until reset", () => {
  let builds = 0;
  const holder = createSingleton(() => {
    builds += 1;
    return { builds };
  });
  expect(holder.get()).toBe(holder.get());
  expect(builds).toBe(1);
  holder.reset();
  expect(holder.get().builds).toBe(2);
});
