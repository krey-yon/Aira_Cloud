import { tool } from "ai";
import { z } from "zod";

import { getRequestContext } from "../realtime/request-context";
import { parseReleaseAt } from "../anime/anime.schedule";
import { getAnimeStore, type AnimeTracker } from "../anime/anime.store";

function publicTracker(tracker: AnimeTracker) {
  return {
    id: tracker.id,
    title: tracker.title,
    imageUrl: tracker.imageUrl,
    kind: tracker.kind,
    episode: tracker.episode,
    status: tracker.status,
    nextReleaseAt: new Date(tracker.nextReleaseAt).toISOString(),
    lastNotifiedAt: tracker.lastNotifiedAt
      ? new Date(tracker.lastNotifiedAt).toISOString()
      : null,
    lastError: tracker.lastError ?? null,
  };
}

export const createAnimeTrackerTool = tool({
  description: [
    "Track a weekly anime or manhwa release and email when the next episode or chapter drops.",
    "Pass releaseAt as ISO 8601 (offset preferred). Missing offset is treated as Asia/Kolkata (+05:30).",
    "Reminders recur every 7 days from that clock time. Email only, no widget.",
  ].join(" "),
  inputSchema: z.object({
    title: z.string().min(1).describe("Show title, e.g. Frieren"),
    imageUrl: z.string().url().describe("Cover image URL used in the reminder email"),
    releaseAt: z
      .string()
      .min(1)
      .describe("Next release datetime as ISO 8601. Offset preferred. Example: 2026-09-16T21:30:00+05:30"),
    kind: z
      .enum(["anime", "manhwa"])
      .optional()
      .describe("Copy uses Episode for anime and Chapter for manhwa. Default anime."),
    episode: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Next episode or chapter number to announce. Default 1."),
  }),
  execute: async (input) => {
    try {
      const tracker = getAnimeStore().create({
        title: input.title,
        imageUrl: input.imageUrl,
        releaseAt: input.releaseAt,
        kind: input.kind,
        episode: input.episode,
        clientId: getRequestContext().clientId,
      });
      return {
        ok: true,
        tracker: publicTracker(tracker),
        summary: `Tracking ${tracker.title} weekly from ${publicTracker(tracker).nextReleaseAt}.`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
});

export const listAnimeTrackersTool = tool({
  description: "List anime and manhwa release trackers (all statuses unless filtered).",
  inputSchema: z.object({
    status: z.enum(["active", "paused", "error"]).optional(),
    limit: z.number().int().positive().max(100).optional(),
  }),
  execute: async ({ status, limit }) => {
    const trackers = getAnimeStore().list({
      status,
      limit: limit ?? 20,
      ...(getRequestContext().clientId
        ? { clientId: getRequestContext().clientId }
        : {}),
    });
    return {
      ok: true,
      trackers: trackers.map(publicTracker),
    };
  },
});

export const updateAnimeTrackerTool = tool({
  description:
    "Update an anime or manhwa tracker by id. Patch title, cover, release time, kind, or episode, and/or pause or resume.",
  inputSchema: z.object({
    id: z.string().describe("Tracker id from create_anime_tracker / list_anime_trackers"),
    title: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
    releaseAt: z.string().min(1).optional().describe("New next-release ISO 8601 datetime"),
    kind: z.enum(["anime", "manhwa"]).optional(),
    episode: z.number().int().positive().optional(),
    action: z.enum(["pause", "resume"]).optional(),
  }),
  execute: async (input) => {
    try {
      const store = getAnimeStore();
      const current = store.get(input.id);
      if (!current) return { ok: false, error: "Not found" };
      const tracker = store.update(input.id, {
        title: input.title,
        imageUrl: input.imageUrl,
        kind: input.kind,
        episode: input.episode,
        ...(input.releaseAt ? { nextReleaseAt: parseReleaseAt(input.releaseAt) } : {}),
        ...(input.action === "pause" ? { status: "paused" as const } : {}),
        ...(input.action === "resume"
          ? { status: "active" as const, lastError: undefined, lastAttemptAt: undefined }
          : {}),
      });
      if (!tracker) return { ok: false, error: "Not found" };
      return { ok: true, tracker: publicTracker(tracker) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
});

export const deleteAnimeTrackerTool = tool({
  description: "Delete an anime or manhwa tracker by id and stop its weekly reminder emails.",
  inputSchema: z.object({
    id: z.string().describe("Tracker id from create_anime_tracker / list_anime_trackers"),
  }),
  execute: async ({ id }) => {
    const ok = getAnimeStore().delete(id);
    return ok ? { ok: true, deleted: id } : { ok: false, error: "Not found" };
  },
});
