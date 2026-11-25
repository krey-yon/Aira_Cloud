import { tool } from "ai";
import { z } from "zod";

import {
  analyzePublicNotionPage,
  getPublicNotionLastUpdated,
  toolError,
} from "../integrations/notion-public";

const urlOrPageId = {
  url: z
    .string()
    .optional()
    .describe("Notion share URL (notion.so or *.notion.site), including query ?p="),
  pageId: z
    .string()
    .optional()
    .describe("Raw Notion page id (32-hex or dashed UUID)"),
};

export const notionAnalyzePublicPageTool = tool({
  description: [
    "Analyze what is publicly discoverable about a Notion page without authentication.",
    "Returns sharing posture (public / login-required / not-public / deleted), space identity,",
    "public title/icon/cover, content outline, and last-updated time as ISO + relative 'updated ago'",
    "when Notion exposes it. Use for share-link intel / OSINT. Do NOT use for private workspace edits",
    "(use authenticated notion_* tools instead). Provide url or pageId.",
  ].join(" "),
  inputSchema: z.object({
    ...urlOrPageId,
    includeOgFallback: z
      .boolean()
      .default(true)
      .describe("Fetch Open Graph / HTML meta when public content is thin (default true)"),
  }),
  execute: async ({ url, pageId, includeOgFallback }) => {
    try {
      if (!url?.trim() && !pageId?.trim()) {
        return { ok: false as const, error: "Provide url or pageId" };
      }
      return await analyzePublicNotionPage({ url, pageId, includeOgFallback });
    } catch (error) {
      return toolError(error);
    }
  },
});

export const notionPublicLastUpdatedTool = tool({
  description: [
    "Parse a Notion URL/page id and return when the page was last updated, if publicly visible.",
    "Output includes ISO lastEditedTime and a relative label like '3 hours ago' / '2 days ago' / '1 month ago'.",
    "Works only for publicly readable pages; login-required or private pages return available:false.",
    "Provide url or pageId.",
  ].join(" "),
  inputSchema: z.object(urlOrPageId),
  execute: async ({ url, pageId }) => {
    try {
      if (!url?.trim() && !pageId?.trim()) {
        return { ok: false as const, error: "Provide url or pageId" };
      }
      return await getPublicNotionLastUpdated({ url, pageId });
    } catch (error) {
      return toolError(error);
    }
  },
});
