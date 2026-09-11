export type ArtifactValue = string | number | boolean | null | Record<string, unknown>;

/**
 * Per-job bag for tool outputs the next step must reuse (Notion page ids, urls).
 */
export class ArtifactBag {
  private readonly values = new Map<string, ArtifactValue>();

  set(key: string, value: ArtifactValue): void {
    this.values.set(key, value);
  }

  get<T extends ArtifactValue = ArtifactValue>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  entries(): Array<{ key: string; value: ArtifactValue }> {
    return [...this.values.entries()].map(([key, value]) => ({ key, value }));
  }

  clear(): void {
    this.values.clear();
  }

  /** Best-effort extract of Notion ids/urls from a tool result. */
  ingestToolResult(toolName: string, result: unknown): void {
    if (!result || typeof result !== "object") return;
    const obj = result as Record<string, unknown>;
    if (obj.ok === false) return;

    if (toolName === "notion_search" && Array.isArray(obj.results)) {
      const first = obj.results[0] as Record<string, unknown> | undefined;
      if (first?.id && typeof first.id === "string") {
        this.set("notion.lastSearchId", first.id);
      }
      if (first?.url && typeof first.url === "string") {
        this.set("notion.lastSearchUrl", first.url);
      }
      if (first?.title && typeof first.title === "string") {
        this.set("notion.lastSearchTitle", first.title);
      }
      this.set("notion.searchCount", obj.results.length);
    }

    if (
      (toolName === "notion_read_page" ||
        toolName === "notion_write_page" ||
        toolName === "notion_update_page" ||
        toolName === "notion_create_page") &&
      typeof obj.id === "string"
    ) {
      this.set("notion.pageId", obj.id);
      if (typeof obj.url === "string") this.set("notion.pageUrl", obj.url);
      if (typeof obj.title === "string") this.set("notion.pageTitle", obj.title);
    }
  }

  toPromptBlock(): string {
    const entries = this.entries();
    if (entries.length === 0) return "";
    const lines = entries.map(({ key, value }) => `- ${key}: ${JSON.stringify(value)}`);
    return [
      "# Artifacts from this run",
      "Reuse these ids/urls. Prefer writing to an existing Notion page id over creating a new page.",
      ...lines,
    ].join("\n");
  }
}
