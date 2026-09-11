import { z } from "zod";

import { EpochMs } from "./primitives";

export const ConditionOp = z.enum(["eq", "neq", "truthy", "falsy", "contains", "gt", "lt"]);
export type ConditionOp = z.infer<typeof ConditionOp>;

export const WatchCondition = z.object({
  path: z.string().min(1),
  op: ConditionOp,
  value: z.string().optional(),
});
export type WatchCondition = z.infer<typeof WatchCondition>;

export const WatcherStatus = z.enum(["active", "paused", "fired", "error"]);
export type WatcherStatus = z.infer<typeof WatcherStatus>;

export const WatcherWrite = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1),
  prompt: z.string().optional(),
  resourceUrl: z.string().url(),
  conditions: z.array(WatchCondition).min(1),
  intervalMinutes: z.number().int().min(1).max(1440).optional(),
  notifyEmail: z.boolean().optional(),
  notifyWidget: z.boolean().optional(),
  clientId: z.string().optional(),
  skillId: z.string().optional(),
});
export type WatcherWrite = z.infer<typeof WatcherWrite>;

export const Watcher = z.object({
  id: z.string().min(1),
  title: z.string(),
  prompt: z.string(),
  resourceUrl: z.string(),
  conditions: z.array(WatchCondition).min(1),
  intervalMinutes: z.number().int().min(1).max(1440),
  notifyEmail: z.boolean(),
  notifyWidget: z.boolean(),
  status: WatcherStatus,
  clientId: z.string().optional(),
  skillId: z.string().optional(),
  nextCheckAt: EpochMs,
  lastCheckedAt: EpochMs.optional(),
  lastValue: z.string().optional(),
  lastError: z.string().optional(),
  lastFiredAt: EpochMs.optional(),
  lastNudge: z.string().optional(),
  createdAt: EpochMs,
  updatedAt: EpochMs,
});
export type Watcher = z.infer<typeof Watcher>;

export const NotifyStatus = z.enum(["pending", "delivered", "skipped", "failed"]);
export type NotifyStatus = z.infer<typeof NotifyStatus>;

export const NotifyEvent = z.object({
  id: z.string().min(1),
  watcherId: z.string().optional(),
  clientId: z.string().optional(),
  title: z.string(),
  body: z.string(),
  status: NotifyStatus,
  emailSent: z.boolean(),
  widgetSent: z.boolean(),
  createdAt: EpochMs,
  deliveredAt: EpochMs.optional(),
  error: z.string().optional(),
});
export type NotifyEvent = z.infer<typeof NotifyEvent>;
