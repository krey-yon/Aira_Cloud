import { z } from "zod";

export const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.string().optional(),
  kind: z.string().optional(),
  before: z.coerce.number().optional(),
  clientId: z.string().optional(),
  full: z.enum(["1", "true"]).optional(),
});
export type ListQuery = z.infer<typeof ListQuery>;

export const HealthResponse = z.object({
  ok: z.literal(true),
  service: z.literal("aira-on-cloud"),
  authRequired: z.boolean(),
  scheduler: z.literal(true),
  console: z.literal(true),
  gmail: z.boolean(),
  workersAi: z.object({
    accountConfigured: z.boolean(),
    tokenConfigured: z.boolean(),
    model: z.string(),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
