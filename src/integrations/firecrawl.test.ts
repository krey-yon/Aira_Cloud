import { afterEach, describe, expect, mock, test } from "bun:test";

import { config } from "../config";
import { scrapeWithFirecrawl } from "./firecrawl";

describe("scrapeWithFirecrawl", () => {
  const originalFetch = globalThis.fetch;
  const originalKey = config.firecrawlApiKey;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (config as { firecrawlApiKey: string }).firecrawlApiKey = originalKey;
  });

  test("truncates markdown when maxCharacters is set", async () => {
    (config as { firecrawlApiKey: string }).firecrawlApiKey = "test-key";
    globalThis.fetch = mock(async () =>
      Response.json({
        success: true,
        data: {
          markdown: "abcdefghij",
          metadata: { title: "T" },
        },
      }),
    ) as typeof fetch;

    const page = await scrapeWithFirecrawl("https://example.com", {
      maxCharacters: 5,
    });
    expect(page.markdown).toBe("abcde");
    expect(page.title).toBe("T");
    expect(page.url).toBe("https://example.com");
  });

  test("throws when key is missing", async () => {
    (config as { firecrawlApiKey: string }).firecrawlApiKey = "";
    await expect(scrapeWithFirecrawl("https://example.com")).rejects.toThrow(
      /FIRECRAWL_API_KEY/,
    );
  });
});
