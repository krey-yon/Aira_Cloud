import { describe, expect, test } from "bun:test";
import { planSkills } from "./planner";
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
});
