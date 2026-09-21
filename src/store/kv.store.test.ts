import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { KvStore, resetStoreForTests } from "./kv.store";

function tempStore() {
  const dir = mkdtempSync(join(tmpdir(), "aira-store-"));
  const store = new KvStore(join(dir, "store.sqlite"));
  return { dir, store };
}

afterEach(() => {
  resetStoreForTests();
});

test("empty dump is an empty map with epoch 0", () => {
  const { dir, store } = tempStore();
  try {
    expect(store.dump()).toEqual({ store: {}, epoch: 0 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("put stamps updatedAt, bumps epoch, and dump lists the entry", () => {
  const { dir, store } = tempStore();
  try {
    const before = Date.now();
    const entry = store.put("email-sig", "Best,\nVikas");
    expect(entry.key).toBe("email-sig");
    expect(entry.value).toBe("Best,\nVikas");
    expect(entry.updatedAt).toBeGreaterThanOrEqual(before);
    expect(store.dump()).toEqual({
      store: { "email-sig": entry },
      epoch: 1,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("put of the same key+value still stamps and bumps epoch", () => {
  const { dir, store } = tempStore();
  try {
    const first = store.put("k", "v");
    const second = store.put("k", "v");
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
    expect(store.dump().epoch).toBe(2);
    expect(store.dump().store.k?.value).toBe("v");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("delete removes a row and bumps epoch only when a row existed", () => {
  const { dir, store } = tempStore();
  try {
    store.put("keep", "1");
    store.put("gone", "2");
    expect(store.delete("gone")).toBe(true);
    const afterDelete = store.dump();
    expect(afterDelete.epoch).toBe(3);
    expect(Object.keys(afterDelete.store)).toEqual(["keep"]);
    expect(afterDelete.store.keep?.value).toBe("1");
    expect(store.delete("gone")).toBe(false);
    expect(store.dump().epoch).toBe(3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
