import { z } from "zod";

import { IsoDateTime } from "./primitives";

export const MailNodeStatus = z.enum(["draft", "scheduled", "sent", "cancelled", "discarded"]);
export type MailNodeStatus = z.infer<typeof MailNodeStatus>;

export const ImportanceScore = z.object({
  score: z.number().min(0).max(100),
  label: z.enum(["low", "medium", "high", "critical"]),
  reasons: z.array(z.string()),
  scoredAt: IsoDateTime,
});
export type ImportanceScore = z.infer<typeof ImportanceScore>;

export const MailTemplate = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subjectTemplate: z.string(),
  bodyMarkdown: z.string(),
  variables: z.array(z.string()),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type MailTemplate = z.infer<typeof MailTemplate>;

export const MailNode = z.object({
  id: z.string().min(1),
  accountEmail: z.string().min(1),
  to: z.array(z.string()).min(1),
  cc: z.array(z.string()),
  bcc: z.array(z.string()),
  subject: z.string(),
  body: z.string(),
  status: MailNodeStatus,
  templateId: z.string().optional(),
  importance: ImportanceScore.optional(),
  scheduleTaskId: z.string().optional(),
  runAt: IsoDateTime.optional(),
  gmailMessageId: z.string().optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type MailNode = z.infer<typeof MailNode>;

export const RecentMailCard = z.object({
  id: z.string().min(1),
  from: z.string(),
  fromName: z.string(),
  subject: z.string(),
  preview: z.string(),
  date: z.string(),
});
export type RecentMailCard = z.infer<typeof RecentMailCard>;

export const MailBoard = z.object({
  drafts: z.array(MailNode),
  scheduled: z.array(MailNode),
  recent: z.array(RecentMailCard),
});
export type MailBoard = z.infer<typeof MailBoard>;

export const SendDraftResult = z.discriminatedUnion("alreadySent", [
  z.object({ alreadySent: z.literal(true), draft: MailNode }),
  z.object({
    alreadySent: z.literal(false),
    draft: MailNode,
    sent: z.object({ id: z.string(), threadId: z.string() }),
  }),
]);
export type SendDraftResult = z.infer<typeof SendDraftResult>;
