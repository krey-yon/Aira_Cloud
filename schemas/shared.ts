import { z } from "zod";

import { EpochMs } from "./primitives";

export const ErrorBody = z.object({
  error: z.string().min(1),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

export const CloudConfig = z.object({
  apiKey: z.string(),
  cloudflareAccountId: z.string(),
  cloudflareApiToken: z.string(),
  defaultModel: z.string().min(1),
  notionToken: z.string(),
  notionParentPageId: z.string(),
  notionVersion: z.string(),
  exaApiKey: z.string(),
  firecrawlApiKey: z.string(),
  port: z.number().int().positive(),
  cloudToken: z.string(),
  schedulerDbPath: z.string(),
  watchersDbPath: z.string(),
  notifyDbPath: z.string(),
  resendApiKey: z.string(),
  resendFrom: z.string(),
  notifyEmail: z.string(),
  watcherTickMs: z.number(),
  gmailDbPath: z.string(),
  mailDbPath: z.string(),
  canvasDbPath: z.string(),
  skillsDbPath: z.string(),
  publicBaseUrl: z.string().min(1),
  canvasWordCap: z.number().int().positive(),
  canvasTtlMs: z.number().int().positive(),
  googleClientId: z.string(),
  googleClientSecret: z.string(),
  gmailRedirectUri: z.string(),
  schedulerTickMs: z.number(),
  redisUrl: z.string(),
});
export type CloudConfig = z.infer<typeof CloudConfig>;

export const ServerLog = z.object({
  id: z.string().min(1),
  at: EpochMs,
  kind: z.enum(["job", "tool", "error", "server"]),
  level: z.enum(["info", "warn", "error"]),
  title: z.string(),
  body: z.string(),
  jobId: z.string().optional(),
  clientId: z.string().optional(),
  skillId: z.string().optional(),
  source: z.string().optional(),
});
export type ServerLog = z.infer<typeof ServerLog>;

export const CollectErrorInput = z.object({
  message: z.string().trim().min(1),
  code: z.string().optional(),
  source: z.string().optional(),
  clientId: z.string().optional(),
  jobId: z.string().optional(),
  url: z.string().optional(),
  stack: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CollectErrorInput = z.infer<typeof CollectErrorInput>;

export const CollectedError = CollectErrorInput.extend({
  id: z.string().min(1),
  createdAt: EpochMs,
});
export type CollectedError = z.infer<typeof CollectedError>;
