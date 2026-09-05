import { tool } from "ai";
import { z } from "zod";

import { getRequestContext } from "../lib/request-context";
import { getWatcherStore } from "../services/watcher.store";

const conditionOp = z.enum([
  "eq",
  "neq",
  "truthy",
  "falsy",
  "contains",
  "gt",
  "lt",
]);

export const createWatcherTool = tool({
  description: [
    "Create a proactive watcher that polls a GET URL on an interval,",
    "checks a JSON field condition, and notifies the human (widget + email) when it matches.",
    "Example: watch https://api.example.com/status until data.active is true every 5 minutes.",
    "Notifications only deliver while the Aira extension is online (Mac awake).",
  ].join(" "),
  inputSchema: z.object({
    title: z.string().min(1).describe("Short label, e.g. Waitlist open"),
    resourceUrl: z.string().url().describe("GET endpoint that returns JSON"),
    conditionPath: z
      .string()
      .min(1)
      .describe("Dot path in the JSON, e.g. active or data.status"),
    conditionOp: conditionOp
      .optional()
      .describe("Comparison op (default truthy). Use eq with conditionValue for exact match."),
    conditionValue: z
      .string()
      .optional()
      .describe("Expected value for eq/neq/contains/gt/lt"),
    intervalMinutes: z
      .number()
      .positive()
      .max(1440)
      .optional()
      .describe("How often to check (minutes). Default 5."),
    prompt: z.string().optional().describe("Human-readable description of what is being watched"),
    notifyEmail: z.boolean().optional().describe("Email when fired (default true)"),
    notifyWidget: z.boolean().optional().describe("Widget nudge when extension online (default true)"),
  }),
  execute: async (input) => {
    try {
      const watcher = getWatcherStore().create({
        title: input.title,
        resourceUrl: input.resourceUrl,
        conditionPath: input.conditionPath,
        conditionOp: input.conditionOp,
        conditionValue: input.conditionValue,
        intervalMinutes: input.intervalMinutes,
        prompt: input.prompt,
        notifyEmail: input.notifyEmail,
        notifyWidget: input.notifyWidget,
        clientId: getRequestContext().clientId,
      });
      return {
        ok: true,
        watcher: {
          id: watcher.id,
          title: watcher.title,
          resourceUrl: watcher.resourceUrl,
          conditionPath: watcher.conditionPath,
          conditionOp: watcher.conditionOp,
          conditionValue: watcher.conditionValue,
          intervalMinutes: watcher.intervalMinutes,
          status: watcher.status,
          nextCheckAt: new Date(watcher.nextCheckAt).toISOString(),
        },
        summary: `Watching ${watcher.resourceUrl} every ${watcher.intervalMinutes}m for ${watcher.conditionPath} ${watcher.conditionOp}${
          watcher.conditionValue ? `=${watcher.conditionValue}` : ""
        }.`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
});

export const listWatchersTool = tool({
  description: "List Aira watchers (active by default).",
  inputSchema: z.object({
    status: z.enum(["active", "paused", "fired", "error"]).optional(),
    limit: z.number().int().positive().max(100).optional(),
  }),
  execute: async ({ status, limit }) => {
    const watchers = getWatcherStore().list({
      status: status ?? "active",
      limit: limit ?? 20,
      ...(getRequestContext().clientId
        ? { clientId: getRequestContext().clientId }
        : {}),
    });
    return {
      ok: true,
      watchers: watchers.map((w) => ({
        id: w.id,
        title: w.title,
        resourceUrl: w.resourceUrl,
        conditionPath: w.conditionPath,
        conditionOp: w.conditionOp,
        conditionValue: w.conditionValue,
        intervalMinutes: w.intervalMinutes,
        status: w.status,
        lastValue: w.lastValue,
        lastError: w.lastError,
        nextCheckAt: new Date(w.nextCheckAt).toISOString(),
      })),
    };
  },
});

export const updateWatcherTool = tool({
  description: "Pause, resume (re-arm), or delete a watcher by id.",
  inputSchema: z.object({
    id: z.string().describe("Watcher id from create_watcher / list_watchers"),
    action: z.enum(["pause", "resume", "delete"]),
  }),
  execute: async ({ id, action }) => {
    const store = getWatcherStore();
    if (action === "delete") {
      const ok = store.delete(id);
      return ok ? { ok: true, deleted: id } : { ok: false, error: "Not found" };
    }
    const status = action === "pause" ? "paused" : "active";
    const patch =
      action === "resume"
        ? { status: "active" as const, nextCheckAt: Date.now(), lastError: undefined }
        : { status: "paused" as const };
    const watcher = store.update(id, patch);
    if (!watcher) return { ok: false, error: "Not found" };
    return { ok: true, watcher: { id: watcher.id, status: watcher.status } };
  },
});
