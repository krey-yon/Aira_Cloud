import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CanvasStore } from "./canvas.store";

test("canvas get returns null and deletes the row after TTL", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aira-canvas-ttl-"));
  try {
    const store = new CanvasStore(join(dir, "canvas.sqlite"), 20);
    const record = store.put({ markdown: "hello", title: "t" });
    expect(store.get(record.id)?.id).toBe(record.id);
    await Bun.sleep(50);
    expect(store.get(record.id)).toBeNull();
    // Reopened with a generous TTL still misses — the row was deleted, not just filtered.
    const reopened = new CanvasStore(join(dir, "canvas.sqlite"), 3_600_000);
    expect(reopened.get(record.id)).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("canvas list returns newest first, honors limit, excludes expired", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aira-canvas-list-"));
  try {
    const store = new CanvasStore(join(dir, "canvas.sqlite"), 3_600_000);
    const first = store.put({ markdown: "one", title: "first" });
    const second = store.put({ markdown: "two", title: "second" });
    const ids = store.list().map((c) => c.id);
    expect(ids).toEqual([second.id, first.id]);
    expect(store.list(1).map((c) => c.id)).toEqual([second.id]);

    const short = new CanvasStore(join(dir, "canvas.sqlite"), 20);
    await Bun.sleep(50);
    expect(short.list()).toEqual([]);
    // Expired rows were pruned from disk, not just filtered.
    expect(store.list()).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
