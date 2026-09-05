import { tool } from "ai";
import { z } from "zod";

import { callExaMcp } from "../lib/exa";

export const websearchTool = tool({
  description: [
    `Search the web with Exa. Current year is ${new Date().getFullYear()}.`,
    "Use for current events, recent data, and facts beyond knowledge cutoff.",
    "Write a natural-language query describing the ideal page, not bare keywords.",
    "Include the current year in queries about recent news or events.",
    "If highlights are thin, follow up with webfetch on the best URLs.",
  ].join(" "),
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        "Natural language search query describing the ideal page (not just keywords)",
      ),
    numResults: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(10)
      .describe("Number of search results to return (default: 10)"),
  }),
  execute: async ({ query, numResults }) => {
    const year = new Date().getFullYear();

    try {
      const output = await callExaMcp(
        "web_search_exa",
        { query, numResults },
        30_000,
      );

      return {
        query,
        year,
        provider: "exa",
        numResults,
        output,
      };
    } catch (err) {
      return {
        query,
        year,
        provider: "exa",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
