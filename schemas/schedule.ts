import { z } from "zod";

import { IsoDateTime } from "./primitives";

export const ScheduledTaskStatus = z.enum(["pending", "running", "done", "cancelled", "error"]);
export type ScheduledTaskStatus = z.infer<typeof ScheduledTaskStatus>;

export const ScheduleMetadata = z
  .object({
    mailAction: z.literal("send_draft").optional(),
    draftId: z.string().optional(),
  })
  .catchall(z.unknown());
export type ScheduleMetadata = z.infer<typeof ScheduleMetadata>;

export const ScheduleWrite = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1),
    prompt: z.string().min(1),
    runAt: IsoDateTime.optional(),
    delayMs: z.number().optional(),
    delaySeconds: z.number().optional(),
    delayMinutes: z.number().optional(),
    delayHours: z.number().optional(),
    delayDays: z.number().optional(),
    clientId: z.string().optional(),
    skillId: z.string().optional(),
    metadata: ScheduleMetadata.optional(),
  })
  .refine(
    (v) =>
      Boolean(v.runAt) ||
      [v.delayMs, v.delaySeconds, v.delayMinutes, v.delayHours, v.delayDays].some((n) => (n ?? 0) > 0),
    {
      message: "Provide runAt or a positive delay",
    },
  );
export type ScheduleWrite = z.infer<typeof ScheduleWrite>;

export const ScheduledTask = z.object({
  id: z.string().min(1),
  clientId: z.string().optional(),
  title: z.string(),
  prompt: z.string(),
  skillId: z.string().optional(),
  runAt: IsoDateTime,
  status: ScheduledTaskStatus,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  result: z.string().optional(),
  error: z.string().optional(),
  metadata: ScheduleMetadata.optional(),
});
export type ScheduledTask = z.infer<typeof ScheduledTask>;
