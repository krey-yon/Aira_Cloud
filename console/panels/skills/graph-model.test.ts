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
