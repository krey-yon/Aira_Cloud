import { describe, expect, test } from "bun:test";
import { ArtifactBag } from "./artifacts";

describe("ArtifactBag", () => {
  test("ingests notion search and write results", () => {
    const bag = new ArtifactBag();
    bag.ingestToolResult("notion_search", {
      ok: true,
      results: [{ id: "page_1", url: "https://notion.so/page_1", title: "watch later" }],
    });
    expect(bag.get("notion.lastSearchId")).toBe("page_1");
    bag.ingestToolResult("notion_write_page", {
      ok: true,
      id: "page_1",
      url: "https://notion.so/page_1",
    });
    expect(bag.get("notion.pageId")).toBe("page_1");
    expect(bag.toPromptBlock()).toContain("page_1");
    bag.clear();
    expect(bag.entries()).toHaveLength(0);
  });
});
