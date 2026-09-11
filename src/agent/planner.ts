import type { SkillMeta } from "../skills/types";

export type PlanInput = {
  text: string;
  skillId?: string;
  pageUrl?: string;
  catalog: SkillMeta[];
};

export type SkillPlan = {
  skillIds: string[];
  plan: string;
  maxSteps: number;
};

const MAX_SKILLS = 3;

function scoreSkill(text: string, meta: SkillMeta, pageUrl?: string): number {
  const hay = `${text} ${pageUrl ?? ""}`.toLowerCase();
  let score = 0;
  if (meta.id === "general-assistant") score += 0.2;
  for (const tag of meta.tags) {
    if (tag && hay.includes(tag.toLowerCase())) score += 2;
  }
  for (const word of meta.name.toLowerCase().split(/\s+/)) {
    if (word.length > 2 && hay.includes(word)) score += 1.5;
  }
  const descBits = meta.description.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4);
  for (const bit of descBits.slice(0, 12)) {
    if (hay.includes(bit)) score += 0.5;
  }

  if (/\bnotion\b|\bwikipedia\b|\bwiki\b|\bnotes?\b|\bpage\b/.test(hay) && meta.id === "notion") {
    score += 5;
  }
  if (/\bgmail\b|\bemail\b|\bmail\b|\bdraft\b|\binbox\b/.test(hay) && meta.id === "gmail") {
    score += 5;
  }
  if (/\bverify\b.*\bemail\b|\bemail\b.*\bverify\b|\bdeliverable\b/.test(hay) && meta.id === "email-verify") {
    score += 5;
  }
  if (/\bsearch\b|\bnews\b|\bgoogle\b|\bresearch\b|\blook up\b/.test(hay) && meta.id === "websearch") {
    score += 4;
  }
  if (/\bfetch\b|\bhttps?:\/\//.test(hay) && meta.id === "webfetch") {
    score += 4;
  }
  if (/\bschedule\b|\bremind\b|\bwatcher\b|\blater\b|\btomorrow\b/.test(hay) && meta.id === "general-assistant") {
    score += 3;
  }
  return score;
}

function addComposeEdges(selected: string[], catalog: SkillMeta[]): string[] {
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const out = [...selected];
  for (const id of selected) {
    const meta = byId.get(id);
    if (!meta) continue;
    for (const edge of meta.edges) {
      if (edge.kind !== "compose-with") continue;
      if (out.includes(edge.to)) continue;
      if (out.length >= MAX_SKILLS) break;
      if (byId.has(edge.to)) out.push(edge.to);
    }
  }
  return out.slice(0, MAX_SKILLS);
}

/**
 * Metadata-only planner. Picks 1–3 skills from tags/keywords.
 * Explicit skillId is always included when it exists.
 */
export function planSkills(input: PlanInput): SkillPlan {
  const catalog = input.catalog;
  if (catalog.length === 0) {
    return { skillIds: ["general-assistant"], plan: "empty catalog; default", maxSteps: 8 };
  }

  const byId = new Map(catalog.map((s) => [s.id, s]));
  const scored = catalog
    .map((meta) => ({ meta, score: scoreSkill(input.text, meta, input.pageUrl) }))
    .sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  if (input.skillId) {
    if (byId.has(input.skillId)) {
      picked.push(input.skillId);
    }
  }

  for (const row of scored) {
    if (picked.length >= MAX_SKILLS) break;
    if (row.score <= 0.2 && picked.length > 0) continue;
    if (!picked.includes(row.meta.id)) picked.push(row.meta.id);
  }

  if (picked.length === 0) {
    const fallback = byId.get("general-assistant") ?? catalog[0]!;
    picked.push(fallback.id);
  }

  const withEdges = addComposeEdges(picked, catalog);
  const steps = withEdges.map((id) => byId.get(id)?.maxSteps ?? 5);
  const maxSteps = Math.max(8, ...steps);

  return {
    skillIds: withEdges,
    plan: `Selected ${withEdges.join(", ")} for: ${input.text.slice(0, 120)}`,
    maxSteps,
  };
}
