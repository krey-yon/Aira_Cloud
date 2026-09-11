import { z } from "zod";

export const IsoDateTime = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

export const EpochMs = z.number().int().nonnegative();
export type EpochMs = z.infer<typeof EpochMs>;

export const JsonValue = z.json();
export type JsonValue = z.infer<typeof JsonValue>;

export function idWithPrefix(prefix: `${string}_`) {
  return z.string().min(1).startsWith(prefix);
}

export const jobId = idWithPrefix("job_");
export const jobEventId = idWithPrefix("jevt_");
export const taskId = idWithPrefix("task_");
export const watchId = idWithPrefix("watch_");
export const canvasId = idWithPrefix("cv_");
export const mailId = idWithPrefix("mail_");
export const templateId = idWithPrefix("tpl_");
export const notifyId = idWithPrefix("nq_");
export const errorId = idWithPrefix("err_");
export const gmailAccountId = idWithPrefix("gmail_");
export const logId = idWithPrefix("log_");
export const clientId = idWithPrefix("ext_");
export const questionId = idWithPrefix("q_");
