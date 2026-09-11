import type { SkillEdge, SkillMeta } from "../../src/skills/types";

export type GraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  tier: 0 | 1 | 2 | 3;
};

export type GraphLink = {
  from: string;
  to: string;
  kind: SkillEdge["kind"];
};

export function buildSkillGraph(skills: SkillMeta[]): {
  nodes: GraphNode[];
  links: GraphLink[];
} {
  if (skills.length === 0) return { nodes: [], links: [] };
  const ids = new Set(skills.map((s) => s.id));
  const links: GraphLink[] = [];
  for (const skill of skills) {
    for (const edge of skill.edges) {
      if (!ids.has(edge.to)) continue;
      links.push({ from: skill.id, to: edge.to, kind: edge.kind });
    }
  }

  // Undirected adjacency over valid edges only.
  const adj = new Map<string, string[]>();
  for (const s of skills) adj.set(s.id, []);
  for (const l of links) {
    adj.get(l.from)!.push(l.to);
    if (l.to !== l.from) adj.get(l.to)!.push(l.from);
  }
  // Deterministic neighbor order = input skill order.
  const order = new Map(skills.map((s, i) => [s.id, i]));
  for (const list of adj.values()) list.sort((a, b) => order.get(a)! - order.get(b)!);

  // Hub = max degree (in+out over valid edges), first on tie.
  const degree = new Map<string, number>();
  for (const s of skills) degree.set(s.id, 0);
  for (const l of links) {
    degree.set(l.from, degree.get(l.from)! + 1);
    if (l.to !== l.from) degree.set(l.to, degree.get(l.to)! + 1);
  }
  let hub = skills[0]!.id;
  for (const s of skills) {
    if (degree.get(s.id)! > degree.get(hub)!) hub = s.id;
  }

  // BFS from hub → tier + layout parent.
  const tier = new Map<string, 0 | 1 | 2 | 3>([[hub, 0]]);
  const parent = new Map<string, string>();
  const queue: string[] = [hub];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curTier = tier.get(cur)!;
    if (curTier >= 2) continue; // distance 3+ collapses to tier 3
    for (const next of adj.get(cur)!) {
      if (!tier.has(next)) {
        tier.set(next, curTier === 0 ? 1 : 2);
        parent.set(next, cur);
        queue.push(next);
      }
    }
  }
  for (const s of skills) if (!tier.has(s.id)) tier.set(s.id, 3);

  const CX = 460;
  const CY = 300;
  const pos = new Map<string, { x: number; y: number }>([[hub, { x: CX, y: CY }]]);

  const atTier = (t: number) => skills.filter((s) => tier.get(s.id) === t);
  const l1 = atTier(1);
  l1.forEach((s, i) => {
    const angle = (i / Math.max(l1.length, 1)) * Math.PI * 2 - Math.PI / 2;
    pos.set(s.id, { x: CX + Math.cos(angle) * 170, y: CY + Math.sin(angle) * 170 });
  });

  // L2 fans out around its L1 parent, biased away from hub.
  const l2ByParent = new Map<string, typeof skills>();
  for (const s of atTier(2)) {
    const p = parent.get(s.id)!;
    if (!l2ByParent.has(p)) l2ByParent.set(p, []);
    l2ByParent.get(p)!.push(s);
  }
  for (const [p, kids] of l2ByParent) {
    const pp = pos.get(p)!;
    const outward = Math.atan2(pp.y - CY, pp.x - CX);
    kids.forEach((s, i) => {
      const spread = kids.length > 1 ? (i / (kids.length - 1) - 0.5) * Math.PI * 0.9 : 0;
      const a = outward + spread;
      pos.set(s.id, { x: pp.x + Math.cos(a) * 72, y: pp.y + Math.sin(a) * 72 });
    });
  }

  // L3 fans out around its L2 parent, biased away from grandparent.
  const l3ByParent = new Map<string, typeof skills>();
  const orphans: typeof skills = [];
  for (const s of atTier(3)) {
    const p = parent.get(s.id);
    if (p && tier.get(p) === 2) {
      if (!l3ByParent.has(p)) l3ByParent.set(p, []);
      l3ByParent.get(p)!.push(s);
    } else {
      orphans.push(s);
    }
  }
  for (const [p, kids] of l3ByParent) {
    const pp = pos.get(p)!;
    const gp = parent.get(p);
    const gpPos = gp ? pos.get(gp)! : { x: CX, y: CY };
    const outward = Math.atan2(pp.y - gpPos.y, pp.x - gpPos.x);
    kids.forEach((s, i) => {
      const spread = kids.length > 1 ? (i / (kids.length - 1) - 0.5) * Math.PI : 0;
      const a = outward + spread;
      pos.set(s.id, { x: pp.x + Math.cos(a) * 48, y: pp.y + Math.sin(a) * 48 });
    });
  }
  orphans.forEach((s, i) => {
    const angle = (i / Math.max(orphans.length, 1)) * Math.PI * 2 - Math.PI / 2;
    pos.set(s.id, { x: CX + Math.cos(angle) * 260, y: CY + Math.sin(angle) * 260 });
  });

  const byId = new Map(skills.map((s) => [s.id, s]));
  const nodes = skills.map((s) => ({
    id: s.id,
    label: byId.get(s.id)!.name,
    x: pos.get(s.id)!.x,
    y: pos.get(s.id)!.y,
    tier: tier.get(s.id)!,
  }));
  return { nodes, links };
}
