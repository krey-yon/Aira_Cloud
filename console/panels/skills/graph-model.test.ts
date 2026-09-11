import { expect, test } from "bun:test";
import { buildSkillGraph } from "./graph-model";

test("buildSkillGraph lays out nodes and keeps valid edges", () => {
  const { nodes, links } = buildSkillGraph([
    {
      id: "a",
      name: "A",
      description: "",
      tags: [],
      tools: [],
      edges: [{ to: "b", kind: "compose-with" }],
    },
    {
      id: "b",
      name: "B",
      description: "",
      tags: [],
      tools: [],
      edges: [{ to: "missing", kind: "routes-to" }],
    },
  ]);
  expect(nodes).toHaveLength(2);
  expect(links).toEqual([{ from: "a", to: "b", kind: "compose-with" }]);
});

test("hub is max-degree node at tier 0 with 1-hop neighbors at tier 1", () => {
  const { nodes } = buildSkillGraph([
    { id: "hub", name: "Hub", description: "", tags: [], tools: [], edges: [] },
    {
      id: "a",
      name: "A",
      description: "",
      tags: [],
      tools: [],
      edges: [{ to: "hub", kind: "compose-with" }],
    },
    {
      id: "b",
      name: "B",
      description: "",
      tags: [],
      tools: [],
      edges: [{ to: "hub", kind: "routes-to" }],
    },
  ]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  expect(byId.get("hub")!.tier).toBe(0);
  expect(byId.get("a")!.tier).toBe(1);
  expect(byId.get("b")!.tier).toBe(1);
});

test("2-hop neighbors land at tier 2 and disconnected nodes at tier 3", () => {
  const { nodes } = buildSkillGraph([
    {
      id: "hub",
      name: "Hub",
      description: "",
      tags: [],
      tools: [],
      edges: [
        { to: "mid", kind: "compose-with" },
        { to: "extra", kind: "compose-with" },
      ],
    },
    {
      id: "mid",
      name: "Mid",
      description: "",
      tags: [],
      tools: [],
      edges: [{ to: "leaf", kind: "compose-with" }],
    },
    { id: "leaf", name: "Leaf", description: "", tags: [], tools: [], edges: [] },
    { id: "extra", name: "Extra", description: "", tags: [], tools: [], edges: [] },
    { id: "orphan", name: "Orphan", description: "", tags: [], tools: [], edges: [] },
  ]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  expect(byId.get("hub")!.tier).toBe(0);
  expect(byId.get("mid")!.tier).toBe(1);
  expect(byId.get("leaf")!.tier).toBe(2);
  expect(byId.get("orphan")!.tier).toBe(3);
});

test("empty input returns empty graph and positions are distinct", () => {
  expect(buildSkillGraph([])).toEqual({ nodes: [], links: [] });
  const { nodes } = buildSkillGraph([
    { id: "a", name: "A", description: "", tags: [], tools: [], edges: [] },
    { id: "b", name: "B", description: "", tags: [], tools: [], edges: [] },
  ]);
  expect(`${nodes[0]!.x},${nodes[0]!.y}`).not.toBe(`${nodes[1]!.x},${nodes[1]!.y}`);
});
