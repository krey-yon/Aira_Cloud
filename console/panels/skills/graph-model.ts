import type { SkillEdge, SkillMeta } from "../../src/skills/types";

export type GraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
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
  const n = Math.max(skills.length, 1);
  const nodes = skills.map((skill, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const radius = 120;
    return {
      id: skill.id,
      label: skill.name,
      x: 160 + Math.cos(angle) * radius,
      y: 140 + Math.sin(angle) * radius,
    };
  });
  const ids = new Set(skills.map((s) => s.id));
  const links: GraphLink[] = [];
  for (const skill of skills) {
    for (const edge of skill.edges) {
      if (!ids.has(edge.to)) continue;
      links.push({ from: skill.id, to: edge.to, kind: edge.kind });
    }
  }
  return { nodes, links };
}
