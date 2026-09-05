import { tool } from "ai";
import { z } from "zod";

import { getRequestContext } from "../lib/request-context";
import { getScheduler } from "../scheduler";

const delayFields = {
  delaySeconds: z.number().positive().optional().describe("Run after N seconds"),
  delayMinutes: z.number().positive().optional().describe("Run after N minutes"),
  delayHours: z.number().positive().optional().describe("Run after N hours"),
  delayDays: z.number().positive().optional().describe("Run after N days"),
};

export const scheduleTaskTool = tool({
  description: [
    "Schedule any future task for Aira to execute at a specific time.",
    "Use for deferred work: send an email Monday 9am, research something tonight,",
    "remind the user, write to Notion later, nudge about YouTube, etc.",
    "Prefer runAt as an ISO 8601 datetime with timezone when the user names a clock time.",
    "Otherwise use delayMinutes / delayHours / delayDays.",
    "The prompt must be a complete instruction the agent can execute later without more context.",
  ].join(" "),
  inputSchema: z.object({
    title: z.string().min(1).describe("Short label shown in the schedule list"),
    prompt: z
      .string()
      .min(1)
      .describe(
        "Full instruction to execute at fire time (include email addresses, subjects, URLs, etc.)",
      ),
    runAt: z
      .string()
      .optional()
      .describe(
        "Absolute ISO 8601 datetime, e.g. 2026-09-08T09:00:00+05:30. Prefer when user names a day/time.",
      ),
    ...delayFields,
    skillId: z.string().optional().describe("Optional skill to use when the task fires"),
    clientId: z
      .string()
      .optional()
      .describe("Extension client id to notify (usually omit — server fills this)"),
  }),
  execute: async (input) => {
    try {
      const task = getScheduler().schedule({
        title: input.title,
        prompt: input.prompt,
        runAt: input.runAt,
        delaySeconds: input.delaySeconds,
        delayMinutes: input.delayMinutes,
        delayHours: input.delayHours,
        delayDays: input.delayDays,
        skillId: input.skillId,
        clientId: input.clientId ?? getRequestContext().clientId,
      });
      return {
        ok: true,
        task: {
          id: task.id,
          title: task.title,
          runAt: task.runAt,
          status: task.status,
        },
        summary: `Scheduled “${task.title}” for ${task.runAt}`,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});

export const listScheduledTasksTool = tool({
  description: "List scheduled Aira tasks (pending by default).",
  inputSchema: z.object({
    status: z
      .enum(["pending", "running", "done", "cancelled", "error"])
      .optional()
      .describe("Filter by status (default: pending)"),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  execute: async ({ status, limit }) => {
    const tasks = getScheduler().list({
      status: status ?? "pending",
      limit,
    });
    return {
      count: tasks.length,
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        runAt: task.runAt,
        status: task.status,
        prompt: task.prompt.slice(0, 200),
      })),
    };
  },
});

export const cancelScheduledTaskTool = tool({
  description: "Cancel a pending scheduled task by id.",
  inputSchema: z.object({
    id: z.string().describe("Task id returned by schedule_task"),
  }),
  execute: async ({ id }) => {
    try {
      const task = getScheduler().cancel(id);
      if (!task) return { ok: false, error: "Task not found" };
      return {
        ok: true,
        task: { id: task.id, title: task.title, status: task.status },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
