import { z } from "zod";

import { EpochMs } from "./primitives";

export const SkillEdge = z.object({
  to: z.string().min(1),
  kind: z.enum(["routes-to", "compose-with"]),
});
export type SkillEdge = z.infer<typeof SkillEdge>;

export const SkillWrite = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  tags: z.array(z.string()).optional(),
  instructions: z.string().optional(),
  tools: z.array(z.string()).optional(),
  maxSteps: z.number().int().positive().optional(),
  edges: z.array(SkillEdge).optional(),
});
export type SkillWrite = z.infer<typeof SkillWrite>;

export const Skill = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()),
  instructions: z.string(),
  tools: z.array(z.string()),
  maxSteps: z.number().int().positive().optional(),
  edges: z.array(SkillEdge),
  updatedAt: EpochMs,
});
export type Skill = z.infer<typeof Skill>;

export const SkillMeta = Skill.omit({ instructions: true, updatedAt: true });
export type SkillMeta = z.infer<typeof SkillMeta>;
