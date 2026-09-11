export type SkillEdge = {
  to: string;
  kind: "routes-to" | "compose-with";
};

export type SkillRecord = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  instructions: string;
  tools: string[];
  maxSteps?: number;
  edges: SkillEdge[];
  updatedAt: number;
};

/** Metadata returned to the planner and list APIs (no instruction body). */
export type SkillMeta = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  tools: string[];
  maxSteps?: number;
  edges: SkillEdge[];
};

/** @deprecated Prefer SkillRecord. Kept for call-site compatibility. */
export type Skill = SkillRecord;
