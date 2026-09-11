import { z } from "zod";

import { EpochMs } from "./primitives";

export const GmailAccount = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  accessToken: z.string(),
  refreshToken: z.string(),
  scope: z.string(),
  tokenType: z.string(),
  expiryAt: EpochMs,
  createdAt: EpochMs,
  updatedAt: EpochMs,
});
export type GmailAccount = z.infer<typeof GmailAccount>;

export const GmailStatus = z.object({
  configured: z.boolean(),
  connected: z.boolean(),
  email: z.string().nullable(),
  scopes: z.array(z.string()),
  redirectUri: z.string().nullable(),
});
export type GmailStatus = z.infer<typeof GmailStatus>;

export const GmailMessage = z.object({
  id: z.string().min(1),
  threadId: z.string(),
  snippet: z.string(),
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  date: z.string(),
  internalDate: z.string().optional(),
});
export type GmailMessage = z.infer<typeof GmailMessage>;

export const GmailMessageDetail = GmailMessage.extend({
  body: z.string(),
  labelIds: z.array(z.string()),
});
export type GmailMessageDetail = z.infer<typeof GmailMessageDetail>;
