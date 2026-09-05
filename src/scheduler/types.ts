export type ScheduledTaskStatus =
  | "pending"
  | "running"
  | "done"
  | "cancelled"
  | "error";

export type ScheduledTask = {
  id: string;
  /** Extension client to notify when the task fires / finishes */
  clientId?: string;
  /** Short human label, e.g. "Monday 9am email" */
  title: string;
  /**
   * Instruction the agent should execute when the task fires.
   * Can be anything: send email, research, Notion write, nudge, etc.
   */
  prompt: string;
  skillId?: string;
  /** Absolute fire time (ISO 8601, preferably with timezone offset) */
  runAt: string;
  status: ScheduledTaskStatus;
  createdAt: string;
  updatedAt: string;
  result?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type ScheduleInput = {
  title: string;
  prompt: string;
  /** Absolute ISO datetime. Prefer this when the user named a clock time. */
  runAt?: string;
  /** Relative delay from now (any combination allowed). */
  delayMs?: number;
  delaySeconds?: number;
  delayMinutes?: number;
  delayHours?: number;
  delayDays?: number;
  clientId?: string;
  skillId?: string;
  metadata?: Record<string, unknown>;
  id?: string;
};

export function newTaskId(): string {
  return `task_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** Resolve runAt from absolute ISO or relative delay fields. */
export function resolveRunAt(input: ScheduleInput, now = Date.now()): Date {
  if (input.runAt) {
    const date = new Date(input.runAt);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid runAt datetime: ${input.runAt}`);
    }
    return date;
  }

  const delayMs =
    (input.delayMs ?? 0) +
    (input.delaySeconds ?? 0) * 1000 +
    (input.delayMinutes ?? 0) * 60_000 +
    (input.delayHours ?? 0) * 3_600_000 +
    (input.delayDays ?? 0) * 86_400_000;

  if (delayMs <= 0) {
    throw new Error("Provide runAt (ISO datetime) or a positive delay");
  }

  return new Date(now + delayMs);
}
