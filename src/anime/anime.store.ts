import { Database } from "bun:sqlite";

import { config } from "../config";
import { createSingleton, openSqlite } from "../persist/sqlite";
import { parseReleaseAt, RETRY_AFTER_MS } from "./anime.schedule";

export type AnimeKind = "anime" | "manhwa";
export type AnimeTrackerStatus = "active" | "paused" | "error";

export type AnimeTracker = {
  id: string;
  title: string;
  imageUrl: string;
  kind: AnimeKind;
  episode: number;
  nextReleaseAt: number;
  recurrenceDays: number;
  status: AnimeTrackerStatus;
  lastNotifiedAt?: number;
  lastError?: string;
  lastAttemptAt?: number;
  clientId?: string;
  createdAt: number;
  updatedAt: number;
};

export type AnimeTrackerInput = {
  title: string;
  imageUrl: string;
  releaseAt: string;
  kind?: AnimeKind;
  episode?: number;
  clientId?: string;
};

export type AnimeTrackerPatch = Partial<
  Pick<
    AnimeTracker,
    | "title"
    | "imageUrl"
    | "kind"
    | "episode"
    | "nextReleaseAt"
    | "status"
    | "lastNotifiedAt"
    | "lastError"
    | "lastAttemptAt"
    | "clientId"
  >
>;

type AnimeRow = {
  id: string;
  title: string;
  image_url: string;
  kind: string;
  episode: number;
  next_release_at: number;
  recurrence_days: number;
  status: string;
  last_notified_at: number | null;
  last_error: string | null;
  last_attempt_at: number | null;
  client_id: string | null;
  created_at: number;
  updated_at: number;
};

function newAnimeId() {
  return `anime_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function rowToTracker(row: AnimeRow): AnimeTracker {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    kind: row.kind as AnimeKind,
    episode: row.episode,
    nextReleaseAt: row.next_release_at,
    recurrenceDays: row.recurrence_days,
    status: row.status as AnimeTrackerStatus,
    lastNotifiedAt: row.last_notified_at ?? undefined,
    lastError: row.last_error ?? undefined,
    lastAttemptAt: row.last_attempt_at ?? undefined,
    clientId: row.client_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireUrl(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  try {
    new URL(trimmed);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
  return trimmed;
}

function requireKind(kind: string | undefined): AnimeKind {
  const value = (kind ?? "anime").trim();
  if (value !== "anime" && value !== "manhwa") {
    throw new Error('kind must be "anime" or "manhwa"');
  }
  return value;
}

function requireEpisode(episode: number | undefined): number {
  const value = episode ?? 1;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("episode must be an integer >= 1");
  }
  return value;
}

export class AnimeStore {
  private readonly db: Database;

  constructor(dbPath = config.animeDbPath) {
    this.db = openSqlite(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS anime_trackers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        kind TEXT NOT NULL,
        episode INTEGER NOT NULL,
        next_release_at INTEGER NOT NULL,
        recurrence_days INTEGER NOT NULL,
        status TEXT NOT NULL,
        last_notified_at INTEGER,
        last_error TEXT,
        last_attempt_at INTEGER,
        client_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_anime_status ON anime_trackers (status);
      CREATE INDEX IF NOT EXISTS idx_anime_next ON anime_trackers (next_release_at);
    `);
  }

  create(input: AnimeTrackerInput): AnimeTracker {
    const title = input.title.trim();
    if (!title) throw new Error("title is required");
    const imageUrl = requireUrl(input.imageUrl, "imageUrl");
    const kind = requireKind(input.kind);
    const episode = requireEpisode(input.episode);
    const nextReleaseAt = parseReleaseAt(input.releaseAt);
    const now = Date.now();
    const record: AnimeTracker = {
      id: newAnimeId(),
      title,
      imageUrl,
      kind,
      episode,
      nextReleaseAt,
      recurrenceDays: 7,
      status: "active",
      clientId: input.clientId,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .query(
        `INSERT INTO anime_trackers (
          id, title, image_url, kind, episode, next_release_at, recurrence_days,
          status, last_notified_at, last_error, last_attempt_at, client_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.title,
        record.imageUrl,
        record.kind,
        record.episode,
        record.nextReleaseAt,
        record.recurrenceDays,
        record.status,
        record.clientId ?? null,
        record.createdAt,
        record.updatedAt,
      );
    return record;
  }

  get(id: string): AnimeTracker | undefined {
    const row = this.db.query(`SELECT * FROM anime_trackers WHERE id = ?`).get(id) as
      | AnimeRow
      | null;
    return row ? rowToTracker(row) : undefined;
  }

  list(opts?: {
    status?: AnimeTrackerStatus;
    clientId?: string;
    limit?: number;
  }): AnimeTracker[] {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (opts?.status) {
      clauses.push("status = ?");
      params.push(opts.status);
    }
    if (opts?.clientId) {
      clauses.push("client_id = ?");
      params.push(opts.clientId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .query(
        `SELECT * FROM anime_trackers ${where} ORDER BY next_release_at ASC LIMIT ${limit}`,
      )
      .all(...params) as AnimeRow[];
    return rows.map(rowToTracker);
  }

  due(now = Date.now()): AnimeTracker[] {
    const retryCutoff = now - RETRY_AFTER_MS;
    const rows = this.db
      .query(
        `SELECT * FROM anime_trackers
         WHERE status = 'active' AND next_release_at <= ?
           AND (last_error IS NULL OR last_attempt_at IS NULL OR last_attempt_at <= ?)
         ORDER BY next_release_at ASC
         LIMIT 20`,
      )
      .all(now, retryCutoff) as AnimeRow[];
    return rows.map(rowToTracker);
  }

  update(id: string, patch: AnimeTrackerPatch): AnimeTracker | undefined {
    const current = this.get(id);
    if (!current) return undefined;
    const next: AnimeTracker = {
      ...current,
      title: patch.title?.trim() || current.title,
      imageUrl:
        patch.imageUrl !== undefined
          ? requireUrl(patch.imageUrl, "imageUrl")
          : current.imageUrl,
      kind: patch.kind !== undefined ? requireKind(patch.kind) : current.kind,
      episode:
        patch.episode !== undefined ? requireEpisode(patch.episode) : current.episode,
      nextReleaseAt: patch.nextReleaseAt ?? current.nextReleaseAt,
      status: patch.status ?? current.status,
      lastNotifiedAt:
        "lastNotifiedAt" in patch ? patch.lastNotifiedAt : current.lastNotifiedAt,
      lastError: "lastError" in patch ? patch.lastError : current.lastError,
      lastAttemptAt:
        "lastAttemptAt" in patch ? patch.lastAttemptAt : current.lastAttemptAt,
      clientId: "clientId" in patch ? patch.clientId : current.clientId,
      updatedAt: Date.now(),
    };
    this.db
      .query(
        `UPDATE anime_trackers SET
          title = ?, image_url = ?, kind = ?, episode = ?, next_release_at = ?,
          status = ?, last_notified_at = ?, last_error = ?, last_attempt_at = ?,
          client_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.title,
        next.imageUrl,
        next.kind,
        next.episode,
        next.nextReleaseAt,
        next.status,
        next.lastNotifiedAt ?? null,
        next.lastError ?? null,
        next.lastAttemptAt ?? null,
        next.clientId ?? null,
        next.updatedAt,
        id,
      );
    return next;
  }

  delete(id: string): boolean {
    const result = this.db.query(`DELETE FROM anime_trackers WHERE id = ?`).run(id);
    return result.changes > 0;
  }
}

const animeStore = createSingleton(() => new AnimeStore());

export function getAnimeStore(): AnimeStore {
  return animeStore.get();
}

export function resetAnimeStoreForTests(): void {
  animeStore.reset();
}
