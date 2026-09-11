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
  maxCharsPerSkill: number;
  maxContextChars: number;
};

export const MAX_SKILLS = 3;
// ponytail: GoS-matched bundle budgets; raise only with measured context pressure.
export const DEFAULT_MAX_CHARS_PER_SKILL = 2400;
export const DEFAULT_MAX_CONTEXT_CHARS = 12000;

// GoS-inspired reverse weights: traversing a dependency backwards (from the
// depended-on skill to its dependent) matters more than forward diffusion.
// compose-with ~= dependency, routes-to ~= workflow.
const REVERSE_WEIGHT: Record<string, number> = {
  "compose-with": 1.0,
  "routes-to": 0.5,
};
const PPR_DAMPING = 0.2;
const PPR_MAX_ITER = 50;
const PPR_TOL = 1e-6;
const SEED_TOP_K = 5;

const STOPWORDS = new Set(
  "the,and,for,with,from,that,this,what,when,how,can,you,please,into,over,under,are,was,were,has,have,had,will,would,should,could,about,after,before,between,just,like,more,most,other,some,such,than,then,there,their,them,they,also,all,any,each,her,his,its,may,much,new,now,one,only,out,say,see,two,who,why,not,but,are,the".split(
    ",",
  ),
);

/** Lite query expansion: keyword set the seed scorer matches against. */
export function extractQueryKeywords(text: string, pageUrl?: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const bit of `${text} ${pageUrl ?? ""}`.toLowerCase().split(/[^a-z0-9]+/)) {
    if (bit.length <= 2 || STOPWORDS.has(bit) || seen.has(bit)) continue;
    seen.add(bit);
    out.push(bit);
    if (out.length >= 24) break;
  }
  return out;
}

function scoreSkill(text: string, meta: SkillMeta, pageUrl?: string, keywords?: string[]): number {
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
  // Lexical exact-token bonus: whole-word hits count extra, capped.
  if (keywords && keywords.length > 0) {
    const tokens = new Set(
      `${meta.tags.join(" ")} ${meta.name} ${meta.description}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    );
    let hits = 0;
    for (const kw of keywords) if (tokens.has(kw)) hits += 1;
    score += Math.min(hits, 4);
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

/**
 * Reverse-weighted personalized PageRank over skill edges (GoS retrieval halves:
 * seed → merge → rerank). Returns a normalized score per catalog index.
 */
function propagate(
  catalog: SkillMeta[],
  ranked: { index: number; score: number }[],
  pinIndex?: number,
): number[] {
  const n = catalog.length;
  const idx = new Map(catalog.map((s, i) => [s.id, i] as const));
  const t: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  catalog.forEach((s, i) => {
    for (const edge of s.edges) {
      const j = idx.get(edge.to);
      if (j === undefined) continue;
      t[i]![j]! += 1;
      const rw = REVERSE_WEIGHT[edge.kind] ?? 0;
      if (rw > 0 && j !== i) t[j]![i]! += rw;
    }
  });
  for (let i = 0; i < n; i++) {
    let row = 0;
    for (let j = 0; j < n; j++) row += t[i]![j]!;
    if (row > 0) {
      for (let j = 0; j < n; j++) t[i]![j]! /= row;
    } else {
      t[i]![i] = 1;
    }
  }

  // Personalization: rank-decayed seed weights, pin boosted to top rank.
  const p = new Array<number>(n).fill(0);
  ranked.slice(0, SEED_TOP_K).forEach((row, rank) => {
    p[row.index]! += 1 / (rank + 1);
  });
  if (pinIndex !== undefined) p[pinIndex]! += 1;
  const pSum = p.reduce((a, b) => a + b, 0);
  if (pSum > 0) for (let i = 0; i < n; i++) p[i]! /= pSum;
  else if (n > 0) for (let i = 0; i < n; i++) p[i] = 1 / n;

  let scores = [...p];
  for (let iter = 0; iter < PPR_MAX_ITER; iter++) {
    const next = new Array<number>(n).fill(0);
    for (let j = 0; j < n; j++) {
      let incoming = 0;
      for (let i = 0; i < n; i++) incoming += t[i]![j]! * scores[i]!;
      next[j] = PPR_DAMPING * p[j]! + (1 - PPR_DAMPING) * incoming;
    }
    let delta = 0;
    for (let i = 0; i < n; i++) delta += Math.abs(next[i]! - scores[i]!);
    scores = next;
    if (delta <= PPR_TOL) break;
  }
  const sum = scores.reduce((a, b) => a + b, 0);
  if (sum > 0) scores = scores.map((s) => s / sum);
  return scores;
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

export type SkillBodyLike = { id: string; name: string; instructions: string };

/** Truncate skill bodies to per-skill and total context budgets. */
export function buildSkillBlocks(
  bodies: SkillBodyLike[],
  budget: { maxCharsPerSkill: number; maxContextChars: number },
): string {
  const parts: string[] = [];
  const SEP = "\n\n---\n\n";
  let total = 0;
  for (const b of bodies) {
    const head = `# Skill: ${b.name} (${b.id})\n\n`;
    const sep = parts.length > 0 ? SEP.length : 0;
    let text = b.instructions;
    if (text.length > budget.maxCharsPerSkill) {
      text = `${text.slice(0, budget.maxCharsPerSkill - 3).trimEnd()}...`;
    }
    let block = head + text;
    if (total + sep + block.length > budget.maxContextChars) {
      const room = budget.maxContextChars - total - sep - head.length - 3;
      if (room <= 0) break;
      block = `${head}${text.slice(0, room).trimEnd()}...`;
    }
    parts.push(block);
    total += sep + block.length;
    if (total >= budget.maxContextChars) break;
  }
  return parts.join(SEP);
}

/**
 * Metadata-only planner. Seeds 1–3 skills from tags/keywords (+ lexical
 * exact-match), reranks via reverse-weighted graph propagation, caps the set.
 * Explicit skillId is always included when it exists.
 */
export function planSkills(input: PlanInput): SkillPlan {
  const catalog = input.catalog;
  const budget = {
    maxCharsPerSkill: DEFAULT_MAX_CHARS_PER_SKILL,
    maxContextChars: DEFAULT_MAX_CONTEXT_CHARS,
  };
  if (catalog.length === 0) {
    return { skillIds: ["general-assistant"], plan: "empty catalog; default", maxSteps: 8, ...budget };
  }

  const byId = new Map(catalog.map((s) => [s.id, s]));
  const keywords = extractQueryKeywords(input.text, input.pageUrl);
  const scored = catalog
    .map((meta, index) => ({ meta, index, score: scoreSkill(input.text, meta, input.pageUrl, keywords) }))
    .sort((a, b) => b.score - a.score);

  const pinIndex = input.skillId && byId.has(input.skillId)
    ? catalog.findIndex((s) => s.id === input.skillId)
    : undefined;

  // Rerank: half graph propagation, half seed score.
  const ppr = propagate(catalog, scored, pinIndex);
  const maxSeed = Math.max(0, ...scored.map((r) => r.score));
  const ranked = scored
    .map((row) => ({
      ...row,
      final: 0.5 * ppr[row.index]! + 0.5 * (maxSeed > 0 ? row.score / maxSeed : 0),
    }))
    .sort((a, b) => b.final - a.final || b.score - a.score);

  const picked: string[] = [];
  if (pinIndex !== undefined) picked.push(catalog[pinIndex]!.id);

  // Seed gate exempts graph-promoted nodes: a skill the keywords miss can
  // still ride in on propagation mass (above uniform share).
  const uniform = 1 / catalog.length;
  for (const row of ranked) {
    if (picked.length >= MAX_SKILLS) break;
    if (picked.includes(row.meta.id)) continue;
    if (row.score <= 0.2 && ppr[row.index]! < uniform && picked.length > 0) continue;
    picked.push(row.meta.id);
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
    ...budget,
  };
}
