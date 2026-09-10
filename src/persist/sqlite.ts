import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type OpenSqliteOptions = {
  /** Defaults to true. */
  wal?: boolean;
};

/** Open a SQLite file, create the parent directory, and optionally enable WAL. */
export function openSqlite(path: string, opts: OpenSqliteOptions = {}): Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  if (opts.wal !== false) {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  return db;
}

export function createSingleton<T>(factory: () => T): {
  get: () => T;
  reset: () => void;
} {
  let instance: T | null = null;
  return {
    get() {
      if (!instance) instance = factory();
      return instance;
    },
    reset() {
      instance = null;
    },
  };
}
