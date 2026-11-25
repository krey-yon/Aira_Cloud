import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";

import { resetSkillStoreForTests, SkillStore } from "./skill.store";
import { getToolsFor, listToolNames } from "../tools";

const testDb = `${process.cwd()}/data/skills.test.sqlite`;

describe("SkillStore", () => {
  beforeEach(() => {
    try {
      unlinkSync(testDb);
    } catch {}
    resetSkillStoreForTests();
    process.env.SKILLS_DB = testDb;
  });

  afterEach(() => {
    resetSkillStoreForTests();
    try {
      unlinkSync(testDb);
    } catch {}
  });

  test("seeds once and lists metadata without requiring full bodies in meta shape", async () => {
    const store = new SkillStore(testDb);
    await store.ensureSeeded();
    const meta = store.listMeta();
    expect(meta.length).toBe(7);
    expect(meta.every((m) => m.tools.length > 0)).toBe(true);
    expect(meta.some((m) => m.id === "notion-public-intel")).toBe(true);
    await store.ensureSeeded();
    expect(store.listMeta().length).toBe(7);
  });

  test("ensureSeeded merges missing bundled tools into an existing skill row", async () => {
    const store = new SkillStore(testDb);
    store.upsert({
      id: "general-assistant",
      name: "General Assistant",
      description: "stale",
      tags: ["general"],
      instructions: "old body",
      tools: ["ask_user", "websearch", "create_watcher"],
      maxSteps: 8,
      edges: [],
    });
    resetSkillStoreForTests();
    const again = new SkillStore(testDb);
    await again.ensureSeeded();
    const tools = again.get("general-assistant")?.tools ?? [];
    expect(tools).toContain("create_anime_tracker");
    expect(tools).toContain("list_anime_trackers");
    expect(tools).toContain("update_anime_tracker");
    expect(tools).toContain("delete_anime_tracker");
    expect(tools).toContain("create_watcher");
    expect(again.get("general-assistant")?.instructions).toContain("anime");
  });

  test("ensureSeeded merges missing bundled edges without dropping existing ones", async () => {
    const store = new SkillStore(testDb);
    store.upsert({
      id: "general-assistant",
      name: "General Assistant",
      description: "stale",
      tags: ["general"],
      instructions: "old body",
      tools: [
        "ask_user",
        "websearch",
        "webfetch",
        "schedule_task",
        "list_scheduled_tasks",
        "cancel_scheduled_task",
        "create_watcher",
        "list_watchers",
        "update_watcher",
        "create_anime_tracker",
        "list_anime_trackers",
        "update_anime_tracker",
        "delete_anime_tracker",
      ],
      maxSteps: 8,
      edges: [{ to: "gmail", kind: "routes-to" }],
    });
    resetSkillStoreForTests();
    const again = new SkillStore(testDb);
    await again.ensureSeeded();
    const edges = again.get("general-assistant")?.edges ?? [];
    expect(edges).toContainEqual({ to: "gmail", kind: "routes-to" });
    expect(edges).toContainEqual({ to: "notion-public-intel", kind: "routes-to" });
    expect(again.get("notion-public-intel")?.tools).toContain("notion_public_last_updated");
  });

  test("updates body and loads three bodies by id", async () => {
    const store = new SkillStore(testDb);
    await store.ensureSeeded();
    store.upsert({
      id: "notion",
      name: "Notion",
      description: "Notion skill",
      tags: ["notion"],
      instructions: "FIND THEN WRITE ONLY",
      tools: ["ask_user", "notion_search", "notion_write_page"],
      maxSteps: 12,
      edges: [],
    });
    expect(store.get("notion")?.instructions).toContain("FIND THEN WRITE");
    const bodies = store.loadBodies(["general-assistant", "notion", "gmail"]);
    expect(bodies).toHaveLength(3);
    expect(bodies.map((b) => b.id).sort()).toEqual([
      "general-assistant",
      "gmail",
      "notion",
    ]);
  });

  test("getToolsFor scopes tools and drops unknown names", () => {
    const scoped = getToolsFor(["websearch", "not_a_real_tool"]);
    expect(Object.keys(scoped).sort()).toEqual(["ask_user", "websearch"].sort());
    expect(listToolNames().includes("gmail_send")).toBe(true);
    expect("gmail_send" in scoped).toBe(false);
  });

  test("export writes markdown files", async () => {
    const store = new SkillStore(testDb);
    await store.ensureSeeded();
    const dir = `${process.cwd()}/data/skills-export-test`;
    const paths = store.exportToDir(dir);
    expect(paths.length).toBe(7);
    const sample = await Bun.file(paths[0]!).text();
    expect(sample.startsWith("---")).toBe(true);
  });
});
