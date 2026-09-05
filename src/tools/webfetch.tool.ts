import { tool } from "ai";
import { z } from "zod";

import { callExaMcp } from "../lib/exa";

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://")) {
    return `https://${trimmed.slice("http://".length)}`;
  }
  return trimmed;
}

export const webfetchTool = tool({
  description: [
    "Fetch webpage content via Exa as clean markdown.",
    "Use when you have a specific URL to read, summarize, or analyze.",
    "Prefer this after websearch when result highlights are not enough.",
    "Can batch multiple URLs in one call.",
  ].join(" "),
  inputSchema: z.object({
    url: z.string().optional().describe("Single URL to fetch"),
    urls: z
      .array(z.string())
      .min(1)
      .optional()
      .describe("URLs to fetch (batch). Prefer this when reading multiple pages."),
    maxCharacters: z
      .number()
      .int()
      .min(1)
      .max(100_000)
      .default(10_000)
      .describe("Maximum characters to extract per page (default: 10000)"),
  }),
  execute: async ({ url, urls, maxCharacters }) => {
    const list = (urls?.length ? urls : url ? [url] : [])
      .map(normalizeUrl)
      .filter(Boolean);

    if (!list.length) {
      return { error: "Provide url or urls" };
    }

    for (const item of list) {
      if (!item.startsWith("http://") && !item.startsWith("https://")) {
        return { error: `URL must start with http:// or https://: ${item}` };
      }
    }

    try {
      const output = await callExaMcp(
        "web_fetch_exa",
        {
          urls: list,
          maxCharacters,
        },
        45_000,
      );

      return {
        provider: "exa",
        urls: list,
        maxCharacters,
        output,
      };
    } catch (err) {
      return {
        provider: "exa",
        urls: list,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
