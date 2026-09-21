export type StoreEntry = {
  key: string;
  value: string;
  updatedAt: number;
};

export type StoreMap = Record<string, StoreEntry>;

/** Parsed replica snapshot. Epoch is cloud-monotonic and includes deletes. */
export type StoreDump = {
  store: StoreMap;
  epoch: number;
};

export class StoreParseError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "StoreParseError";
  }
}

function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  return Boolean(raw) && typeof raw === "object" && !Array.isArray(raw);
}

/**
 * Strict string entry. Rejects empty key, non-strings, non-finite updatedAt.
 * If expectedKey is set, it must equal entry.key.
 */
export function parseStoreEntry(raw: unknown, expectedKey?: string): StoreEntry {
  if (!isPlainObject(raw)) {
    throw new StoreParseError("store entry must be an object");
  }
  const { key, value, updatedAt } = raw;
  if (typeof key !== "string" || key === "") {
    throw new StoreParseError("key must be a non-empty string");
  }
  if (typeof value !== "string") {
    throw new StoreParseError("value must be a string");
  }
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) {
    throw new StoreParseError("updatedAt must be a finite number");
  }
  if (expectedKey !== undefined && key !== expectedKey) {
    throw new StoreParseError("entry.key must match the expected key");
  }
  return { key, value, updatedAt };
}

/**
 * Build a StoreMap from unknown JSON. Map key is entry.key.
 * A record key that disagrees with entry.key is dropped.
 */
export function parseStoreMap(raw: unknown): StoreMap {
  if (!isPlainObject(raw)) {
    throw new StoreParseError("store must be an object");
  }
  const out: StoreMap = {};
  for (const [recordKey, value] of Object.entries(raw)) {
    let entry: StoreEntry;
    try {
      entry = parseStoreEntry(value);
    } catch {
      throw new StoreParseError("store entries must be objects with key, value, updatedAt");
    }
    if (entry.key !== recordKey) continue;
    out[entry.key] = entry;
  }
  return out;
}

/**
 * Parse GET /v1/store. Accepts { store, epoch } only.
 * Missing or non-integer epoch is a parse failure, not 0.
 */
export function parseStoreDump(raw: unknown): StoreDump {
  if (!isPlainObject(raw)) {
    throw new StoreParseError("store dump must be an object");
  }
  const keys = Object.keys(raw);
  if (keys.length !== 2 || !("store" in raw) || !("epoch" in raw)) {
    throw new StoreParseError("store dump must be { store, epoch }");
  }
  if (typeof raw.epoch !== "number" || !Number.isInteger(raw.epoch)) {
    throw new StoreParseError("epoch must be an integer");
  }
  return { store: parseStoreMap(raw.store), epoch: raw.epoch };
}

/**
 * Per-key local-wins. Used only when both dumps carry the same key.
 * Greater updatedAt wins. Tie returns local.
 */
export function pickEntry(local: StoreEntry, remote: StoreEntry): StoreEntry {
  return remote.updatedAt > local.updatedAt ? remote : local;
}

/**
 * Combine two complete dumps.
 *
 * 1. If remote.epoch < local.epoch, return local unchanged (stale pull).
 * 2. Keys in both: pickEntry (tie local).
 * 3. Keys only in remote: take remote.
 * 4. Keys only in local: drop when remote.epoch > local.epoch (cloud delete).
 *    Keep when epochs are equal (same snapshot, local already matches).
 * 5. Result epoch is max(local.epoch, remote.epoch).
 */
export function mergeMirror(local: StoreDump, remote: StoreDump): StoreDump {
  if (remote.epoch < local.epoch) return local;

  const out: StoreMap = {};
  const keys = new Set([...Object.keys(local.store), ...Object.keys(remote.store)]);
  for (const key of keys) {
    const left = local.store[key];
    const right = remote.store[key];
    if (left && right) {
      out[key] = pickEntry(left, right);
    } else if (right) {
      out[key] = right;
    } else if (left && remote.epoch === local.epoch) {
      out[key] = left;
    }
  }
  return { store: out, epoch: Math.max(local.epoch, remote.epoch) };
}

export function storeEntries(store: StoreMap): StoreEntry[] {
  return Object.values(store).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
