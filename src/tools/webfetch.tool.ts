import { tool } from "ai";
import { z } from "zod";

import { config } from "../config";
import { callExaMcp } from "../lib/exa";
import { scrapeWithFirecrawl } from "../lib/firecrawl";

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://")) {
    return `https://${trimmed.slice("http://".length)}`;
  }
  return trimmed;
}

function isUselessExaOutput(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 40) return true;
  if (trimmed.includes("SOURCE_NOT_AVAILABLE")) return true;
  return false;
}

export const webfetchTool = tool({
  description: [
    "Fetch webpage content as clean markdown (Exa, with Firecrawl fallback).",
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

    let exaError: string | undefined;
    try {
      const output = await callExaMcp(
        "web_fetch_exa",
        {
          urls: list,
          maxCharacters,
        },
        45_000,
      );
      if (!isUselessExaOutput(output)) {
        return {
          provider: "exa",
          urls: list,
          maxCharacters,
          output,
        };
      }
      exaError = "Exa returned empty or unavailable content";
    } catch (err) {
      exaError = err instanceof Error ? err.message : String(err);
    }

    if (!config.firecrawlApiKey) {
      return {
        provider: "exa",
        urls: list,
        error: `Exa failed (${exaError}); Firecrawl fallback unavailable (FIRECRAWL_API_KEY not set)`,
      };
    }

    try {
      const pages = [];
      for (const item of list) {
        pages.push(await scrapeWithFirecrawl(item, { maxCharacters }));
      }
      return {
        provider: "firecrawl",
        fallbackFrom: "exa",
        urls: list,
        maxCharacters,
        pages,
        exaError,
      };
    } catch (err) {
      const firecrawlError = err instanceof Error ? err.message : String(err);
      return {
        provider: "firecrawl",
        urls: list,
        error: `Exa failed (${exaError}); Firecrawl also failed (${firecrawlError})`,
      };
    }
  },
});
