import { describe, expect, test } from "bun:test";
import {
  buildSkillBlocks,
  DEFAULT_MAX_CHARS_PER_SKILL,
  DEFAULT_MAX_CONTEXT_CHARS,
  extractQueryKeywords,
  planSkills,
} from "./planner";
import type { SkillMeta } from "../skills/types";

const catalog: SkillMeta[] = [
  {
    id: "general-assistant",
    name: "General Assistant",
    description: "Default helper",
    tags: ["general", "schedule"],
    tools: ["ask_user"],
    maxSteps: 8,
    edges: [{ to: "websearch", kind: "compose-with" }],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Notion pages",
    tags: ["notion", "notes"],
    tools: ["notion_search"],
    maxSteps: 12,
    edges: [],
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Email drafts",
    tags: ["gmail", "email"],
    tools: ["gmail_send"],
    maxSteps: 12,
    edges: [],
  },
  {
    id: "websearch",
    name: "Web Search",
    description: "Search the web",
    tags: ["web", "search"],
    tools: ["websearch"],
    maxSteps: 8,
    edges: [],
  },
];

describe("planSkills", () => {
  test("pins explicit skillId and caps at three", () => {
    const plan = planSkills({
      text: "update my notion watch later page and search the news",
      skillId: "gmail",
      catalog,
    });
    expect(plan.skillIds).toContain("gmail");
    expect(plan.skillIds.length).toBeLessThanOrEqual(3);
  });

  test("routes notion asks to notion", () => {
    const plan = planSkills({
      text: "add this to the watch later notion page under llm",
      catalog,
    });
    expect(plan.skillIds).toContain("notion");
  });

  test("falls back to general-assistant", () => {
    const plan = planSkills({
      text: "hi",
      catalog,
    });
    expect(plan.skillIds.length).toBeGreaterThan(0);
    expect(plan.skillIds[0]).toBeTruthy();
  });

  test("ignores unknown pin by still planning", () => {
    const plan = planSkills({
      text: "search for bun sqlite",
      skillId: "does-not-exist",
      catalog,
    });
    expect(plan.skillIds).toContain("websearch");
  });

  test("reverse traversal pulls in a dependent the keywords miss", () => {
    const graph: SkillMeta[] = [
      {
        id: "reporter",
        name: "Reporter",
        description: "Assembles deliverables",
        tags: ["report"],
        tools: ["report"],
        edges: [{ to: "parser", kind: "compose-with" }],
      },
      {
        id: "parser",
        name: "Parser",
        description: "Parses binary mesh files",
        tags: ["mesh", "parse"],
        tools: ["parse"],
        edges: [],
      },
      {
        id: "other",
        name: "Other",
        description: "Unrelated helper",
        tags: ["other"],
        tools: ["other"],
        edges: [],
      },
    ];
    const plan = planSkills({ text: "parse my binary mesh files", catalog: graph });
    expect(plan.skillIds).toContain("parser");
    // Reporter never matches the query text, only the graph pulls it in.
    expect(plan.skillIds).toContain("reporter");
  });

  test("plan carries bundle budgets", () => {
    const plan = planSkills({ text: "hi", catalog });
    expect(plan.maxCharsPerSkill).toBe(DEFAULT_MAX_CHARS_PER_SKILL);
    expect(plan.maxContextChars).toBe(DEFAULT_MAX_CONTEXT_CHARS);
  });

  test("extractQueryKeywords drops stopwords and short tokens", () => {
    expect(extractQueryKeywords("the a an parse binary STL file, please!")).toEqual([
      "parse",
      "binary",
      "stl",
      "file",
    ]);
  });

  test("buildSkillBlocks enforces per-skill and total budgets", () => {
    const long = "x".repeat(5000);
    const single = buildSkillBlocks([{ id: "a", name: "A", instructions: long }], {
      maxCharsPerSkill: 100,
      maxContextChars: 10000,
    });
    expect(single.length).toBeLessThanOrEqual("# Skill: A (a)\n\n".length + 100);

    const bodies = [0, 1, 2].map((i) => ({ id: `s${i}`, name: `S${i}`, instructions: "y".repeat(500) }));
    const capped = buildSkillBlocks(bodies, { maxCharsPerSkill: 1000, maxContextChars: 600 });
    expect(capped.length).toBeLessThanOrEqual(600);
    expect(capped).toContain("S0");
  });
});
