import { z } from "zod";

import { IsoDateTime } from "./primitives";

export const CanvasWrite = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  markdown: z.string().min(1),
});
export type CanvasWrite = z.infer<typeof CanvasWrite>;

export const Canvas = z.object({
  id: z.string().min(1),
  title: z.string(),
  markdown: z.string(),
  createdAt: IsoDateTime,
});
export type Canvas = z.infer<typeof Canvas>;

export const CanvasListItem = z.object({
  id: z.string().min(1),
  title: z.string(),
  createdAt: IsoDateTime,
  expiresAt: IsoDateTime,
  url: z.string(),
});
export type CanvasListItem = z.infer<typeof CanvasListItem>;
