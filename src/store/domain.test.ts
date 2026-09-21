import { expect, test } from "bun:test";
import {
  mergeMirror,
  parseStoreDump,
  parseStoreEntry,
  parseStoreMap,
  pickEntry,
  StoreParseError,
  storeEntries,
} from "./domain";

test("parseStoreEntry rejects empty key, non-strings, and non-finite updatedAt", () => {
  expect(() => parseStoreEntry({ key: "", value: "x", updatedAt: 1 })).toThrow(StoreParseError);
  expect(() => parseStoreEntry({ key: "a", value: 1, updatedAt: 1 })).toThrow(StoreParseError);
  expect(() => parseStoreEntry({ key: "a", value: "x", updatedAt: Number.NaN })).toThrow(StoreParseError);
  expect(() => parseStoreEntry({ key: "a", value: "x", updatedAt: Infinity })).toThrow(StoreParseError);
  expect(parseStoreEntry({ key: "a", value: "x", updatedAt: 10 }, "a")).toEqual({
    key: "a",
    value: "x",
    updatedAt: 10,
  });
  expect(() => parseStoreEntry({ key: "a", value: "x", updatedAt: 10 }, "b")).toThrow(StoreParseError);
});

test("parseStoreMap drops a record key that disagrees with entry.key", () => {
  expect(
    parseStoreMap({
      a: { key: "a", value: "keep", updatedAt: 1 },
      wrong: { key: "other", value: "drop", updatedAt: 2 },
    }),
  ).toEqual({
    a: { key: "a", value: "keep", updatedAt: 1 },
  });
});

test("parseStoreDump requires an integer epoch and rejects a missing one", () => {
  expect(parseStoreDump({ store: {}, epoch: 0 })).toEqual({ store: {}, epoch: 0 });
  expect(() => parseStoreDump({ store: {} })).toThrow(StoreParseError);
  expect(() => parseStoreDump({ store: {}, epoch: 1.5 })).toThrow(StoreParseError);
  expect(() => parseStoreDump({ store: {}, epoch: "1" })).toThrow(StoreParseError);
});

test("pickEntry is local-wins on a tie and takes the newer updatedAt", () => {
  const local = { key: "a", value: "local", updatedAt: 200 };
  const older = { key: "a", value: "old", updatedAt: 100 };
  const newer = { key: "a", value: "new", updatedAt: 300 };
  expect(pickEntry(local, older)).toEqual(local);
  expect(pickEntry(local, { ...local, value: "tie" })).toEqual(local);
  expect(pickEntry(local, newer)).toEqual(newer);
});

test("mergeMirror ignores a stale remote epoch", () => {
  const local = { epoch: 5, store: { a: { key: "a", value: "local", updatedAt: 200 } } };
  const remote = { epoch: 4, store: { a: { key: "a", value: "stale", updatedAt: 999 } } };
  expect(mergeMirror(local, remote)).toEqual(local);
});

test("mergeMirror tie on the same key keeps local", () => {
  expect(
    mergeMirror(
      { epoch: 3, store: { a: { key: "a", value: "local", updatedAt: 200 } } },
      { epoch: 3, store: { a: { key: "a", value: "remote", updatedAt: 200 } } },
    ),
  ).toEqual({
    epoch: 3,
    store: { a: { key: "a", value: "local", updatedAt: 200 } },
  });
});

test("mergeMirror takes a remote-only key", () => {
  expect(
    mergeMirror(
      { epoch: 4, store: { a: { key: "a", value: "local", updatedAt: 200 } } },
      { epoch: 4, store: { b: { key: "b", value: "new", updatedAt: 300 } } },
    ),
  ).toEqual({
    epoch: 4,
    store: {
      a: { key: "a", value: "local", updatedAt: 200 },
      b: { key: "b", value: "new", updatedAt: 300 },
    },
  });
});

test("mergeMirror drops a local-only key when the remote epoch is newer", () => {
  expect(
    mergeMirror(
      { epoch: 4, store: { a: { key: "a", value: "local", updatedAt: 200 } } },
      { epoch: 5, store: { b: { key: "b", value: "new", updatedAt: 300 } } },
    ),
  ).toEqual({
    epoch: 5,
    store: { b: { key: "b", value: "new", updatedAt: 300 } },
  });
});

test("storeEntries lists by key", () => {
  expect(
    storeEntries({
      z: { key: "z", value: "2", updatedAt: 2 },
      a: { key: "a", value: "1", updatedAt: 1 },
    }),
  ).toEqual([
    { key: "a", value: "1", updatedAt: 1 },
    { key: "z", value: "2", updatedAt: 2 },
  ]);
});
