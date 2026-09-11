import { z } from "zod";

import { EpochMs } from "./primitives";

export const PageContext = z.object({
  url: z.string().min(1),
  title: z.string(),
  domain: z.string().optional(),
});
export type PageContext = z.infer<typeof PageContext>;

export const JobStatus = z.enum(["queued", "running", "done", "error"]);
export type JobStatus = z.infer<typeof JobStatus>;

export const JobToolCall = z.object({
  name: z.string().min(1),
  arguments: z.string(),
  result: z.unknown(),
});
export type JobToolCall = z.infer<typeof JobToolCall>;

export const Job = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  status: JobStatus,
  text: z.string(),
  skillId: z.string().optional(),
  pageContext: PageContext.optional(),
  content: z.string().optional(),
  toolCalls: z.array(JobToolCall).optional(),
  error: z.string().optional(),
  createdAt: EpochMs,
  updatedAt: EpochMs,
});
export type Job = z.infer<typeof Job>;

export const JobEvent = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  at: EpochMs,
  kind: z.enum(["status", "tool", "answer", "error", "thinking"]),
  message: z.string(),
  payload: z.unknown().optional(),
});
export type JobEvent = z.infer<typeof JobEvent>;

export const AskRequest = z.object({
  text: z.string().trim().min(1),
  skillId: z.string().optional(),
  pageContext: PageContext.optional(),
  clientId: z.string().optional(),
  jobId: z.string().optional(),
});
export type AskRequest = z.infer<typeof AskRequest>;

export const AskResponse = z.object({
  jobId: z.string().min(1),
  status: JobStatus,
});
export type AskResponse = z.infer<typeof AskResponse>;

export const JobHttpResponse = z.object({
  jobId: z.string().min(1),
  status: JobStatus,
  content: z.string().optional(),
  skillId: z.string().optional(),
  toolCalls: z.array(JobToolCall).optional(),
  error: z.string().optional(),
  pageContext: PageContext.optional(),
  text: z.string().optional(),
  clientId: z.string().optional(),
  createdAt: EpochMs.optional(),
  updatedAt: EpochMs.optional(),
});
export type JobHttpResponse = z.infer<typeof JobHttpResponse>;

export const QuestionOption = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});
export type QuestionOption = z.infer<typeof QuestionOption>;

export const WidgetAction = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["link", "dismiss", "reply", "command"]),
  url: z.string().optional(),
  style: z.enum(["primary", "secondary", "danger"]).optional(),
  optionId: z.string().optional(),
});
export type WidgetAction = z.infer<typeof WidgetAction>;

export const Widget = z.object({
  jobId: z.string().optional(),
  title: z.string(),
  body: z.string(),
  kind: z.enum(["ack", "answer", "error", "nudge", "question", "progress", "hidden"]).optional(),
  startFlow: z.boolean().optional(),
  canvasUrl: z.string().optional(),
  questionId: z.string().optional(),
  options: z.array(QuestionOption).optional(),
  allowFreeText: z.boolean().optional(),
  placeholder: z.string().optional(),
  actions: z.array(WidgetAction).optional(),
  format: z.enum(["plain", "markdown"]).optional(),
  dismissAfterMs: z.number().optional(),
  dismiss: z.boolean().optional(),
});
export type Widget = z.infer<typeof Widget>;

export const QuestionReply = z
  .object({
    optionId: z.string().optional(),
    label: z.string().optional(),
    text: z.string().optional(),
  })
  .refine((v) => Boolean(v.optionId || v.label || v.text), {
    message: "question reply needs optionId, label, or text",
  });
export type QuestionReply = z.infer<typeof QuestionReply>;

export const AgentRunResult = z.object({
  content: z.string(),
  skillId: z.string(),
  skillIds: z.array(z.string()).optional(),
  plan: z.string().optional(),
  artifacts: z.array(z.object({ key: z.string(), value: z.unknown() })).optional(),
  toolCalls: z.array(JobToolCall).optional(),
});
export type AgentRunResult = z.infer<typeof AgentRunResult>;
