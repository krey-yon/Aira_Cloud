import { z } from "zod";

export const ToolResult = z.looseObject({
  ok: z.boolean(),
  id: z.string().optional(),
  error: z.string().optional(),
});
export type ToolResult = z.infer<typeof ToolResult>;

export const NotionRef = z.object({
  id: z.string().min(1),
  url: z.string().optional(),
  title: z.string().optional(),
});
export type NotionRef = z.infer<typeof NotionRef>;
