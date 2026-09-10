import { RedisClient } from "bun";

import { config } from "../config";
import { getLogRing } from "./log.ring";

export type CollectedError = {
  id: string;
  message: string;
  code?: string;
  source?: string;
  clientId?: string;
  jobId?: string;
  url?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
};

export type CollectErrorInput = {
  message: string;
  code?: string;
  source?: string;
  clientId?: string;
  jobId?: string;
  url?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
};

const KEY_PREFIX = "error:";
const INDEX_KEY = "error:index";
const INDEX_CAP = 200;
/** Keep collected errors for 30 days. */
const TTL_SECONDS = 60 * 60 * 24 * 30;

function newErrorId() {
  return `err_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Persist extension/cloud client errors as Redis string JSON:
 * key `error:{id}` → JSON value.
 * `error:index` holds newest ids for listing.
 */
export class ErrorStore {
  private client: RedisClient | null = null;

  private redis(): RedisClient {
    if (!this.client) {
      this.client = config.redisUrl
        ? new RedisClient(config.redisUrl)
        : new RedisClient();
    }
    return this.client;
  }

  private async pushIndex(id: string) {
    const redis = this.redis();
    let ids: string[] = [];
    try {
      const raw = await redis.get(INDEX_KEY);
      if (raw) ids = JSON.parse(raw) as string[];
      if (!Array.isArray(ids)) ids = [];
    } catch {
      ids = [];
    }
    ids = [id, ...ids.filter((x) => x !== id)].slice(0, INDEX_CAP);
    await redis.set(INDEX_KEY, JSON.stringify(ids));
  }

  async save(input: CollectErrorInput): Promise<CollectedError> {
    const record: CollectedError = {
      id: newErrorId(),
      message: input.message,
      code: input.code,
      source: input.source,
      clientId: input.clientId,
      jobId: input.jobId,
      url: input.url,
      stack: input.stack,
      metadata: input.metadata,
      createdAt: Date.now(),
    };
    await this.redis().set(
      `${KEY_PREFIX}${record.id}`,
      JSON.stringify(record),
      "EX",
      TTL_SECONDS,
    );
    await this.pushIndex(record.id);
    getLogRing().append({
      kind: "error",
      level: "error",
      title: record.code || "collected-error",
      body: record.message.slice(0, 800),
      jobId: record.jobId,
      clientId: record.clientId,
      source: record.source ?? "collect-error",
    });
    return record;
  }

  async get(id: string): Promise<CollectedError | null> {
    const raw = await this.redis().get(`${KEY_PREFIX}${id}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CollectedError;
    } catch {
      return null;
    }
  }

  async list(limit = 50): Promise<CollectedError[]> {
    const capped = Math.min(Math.max(limit, 1), 200);
    let ids: string[] = [];
    try {
      const raw = await this.redis().get(INDEX_KEY);
      if (raw) ids = JSON.parse(raw) as string[];
      if (!Array.isArray(ids)) ids = [];
    } catch {
      return [];
    }
    const out: CollectedError[] = [];
    for (const id of ids.slice(0, capped)) {
      const record = await this.get(id);
      if (record) out.push(record);
    }
    return out;
  }
}
