import { z } from "zod";

import { JobStatus, PageContext, Widget } from "./agent";

export const RequestContext = z.object({
  clientId: z.string().optional(),
  jobId: z.string().optional(),
});
export type RequestContext = z.infer<typeof RequestContext>;

export const ClientMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), clientId: z.string().min(1), token: z.string().optional() }),
  z.object({ type: z.literal("heartbeat"), clientId: z.string().optional() }),
  z.object({ type: z.literal("context"), url: z.string(), title: z.string(), tabId: z.number().optional() }),
  z.object({
    type: z.literal("ask"),
    jobId: z.string().min(1),
    text: z.string().trim().min(1),
    skillId: z.string().optional(),
    pageContext: PageContext.optional(),
  }),
  z.object({ type: z.literal("cancel"), jobId: z.string().min(1) }),
  z.object({
    type: z.literal("question_reply"),
    jobId: z.string().min(1),
    questionId: z.string().min(1),
    optionId: z.string().optional(),
    label: z.string().optional(),
    text: z.string().optional(),
  }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export const ServerMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("accepted"), jobId: z.string() }),
  z.object({ type: z.literal("status"), jobId: z.string(), status: JobStatus, phase: z.string().optional() }),
  z.object({
    type: z.literal("tool"),
    jobId: z.string(),
    name: z.string(),
    arguments: z.string().optional(),
    result: z.unknown().optional(),
  }),
  z.object({ type: z.literal("answer"), jobId: z.string(), content: z.string(), skillId: z.string().optional() }),
  z.object({ type: z.literal("error"), jobId: z.string().optional(), message: z.string() }),
  z.object({ type: z.literal("notify"), jobId: z.string(), title: z.string(), body: z.string() }),
  Widget.extend({ type: z.literal("widget") }),
  z.object({ type: z.literal("nudge"), reason: z.string(), message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
