import { Database } from "bun:sqlite";

import type { StoreDump, StoreEntry, StoreMap } from "./domain";
import { config } from "../config";
import { createSingleton, openSqlite } from "../persist/sqlite";

type KvRow = {
  key: string;
  value: string;
  updated_at: number;
};

export class KvStore {
  private readonly db: Database;

  constructor(path: string) {
    this.db = openSqlite(path, { wal: false });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        epoch INTEGER NOT NULL
      );
    `);
    this.db.query(`INSERT OR IGNORE INTO meta (id, epoch) VALUES (1, 0)`).run();
  }

  private epoch(): number {
    const row = this.db.query(`SELECT epoch FROM meta WHERE id = 1`).get() as { epoch: number };
    return row.epoch;
  }

  private bumpEpoch(): number {
    this.db.query(`UPDATE meta SET epoch = epoch + 1 WHERE id = 1`).run();
    return this.epoch();
  }

  /** Full replica. Empty store is { store: {}, epoch }. */
  dump(): StoreDump {
    const rows = this.db.query(`SELECT key, value, updated_at FROM kv`).all() as KvRow[];
    const store: StoreMap = {};
    for (const row of rows) {
      store[row.key] = { key: row.key, value: row.value, updatedAt: row.updated_at };
    }
    return { store, epoch: this.epoch() };
  }

  /**
   * Cloud stamps updatedAt = Date.now() and increments epoch.
   * Same key+value still stamps and bumps. Console save is a write.
   */
  put(key: string, value: string): StoreEntry {
    const updatedAt = Date.now();
    const tx = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        )
        .run(key, value, updatedAt);
      this.bumpEpoch();
    });
    tx();
    return { key, value, updatedAt };
  }

  /**
   * True if a row was removed. Epoch bumps only on an actual delete.
   * Missing key is success and does not bump (idempotent no-op).
   */
  delete(key: string): boolean {
    let removed = false;
    const tx = this.db.transaction(() => {
      const result = this.db.query(`DELETE FROM kv WHERE key = ?`).run(key);
      removed = result.changes > 0;
      if (removed) this.bumpEpoch();
    });
    tx();
    return removed;
  }
}

const kvStore = createSingleton(
  () => new KvStore(process.env.STORE_DB ?? config.storeDbPath),
);

export function getStore(): KvStore {
  return kvStore.get();
}

export function resetStoreForTests(): void {
  kvStore.reset();
}
