import { config } from "../config";

export type FirecrawlPage = {
  url: string;
  markdown: string;
  title?: string;
};

type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: { title?: string };
  };
  error?: string;
};

export async function scrapeWithFirecrawl(
  url: string,
  opts?: { maxCharacters?: number },
): Promise<FirecrawlPage> {
  if (!config.firecrawlApiKey) {
    throw new Error("FIRECRAWL_API_KEY is required for Firecrawl scrape");
  }

  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.firecrawlApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
    signal: AbortSignal.timeout(45_000),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Firecrawl scrape failed (${response.status}): ${body.slice(0, 240)}`,
    );
  }

  let parsed: FirecrawlScrapeResponse;
  try {
    parsed = JSON.parse(body) as FirecrawlScrapeResponse;
  } catch {
    throw new Error("Firecrawl scrape returned invalid JSON");
  }

  if (parsed.error) {
    throw new Error(`Firecrawl scrape error: ${parsed.error}`);
  }

  let markdown = parsed.data?.markdown?.trim() ?? "";
  if (!markdown) {
    throw new Error(`Firecrawl returned empty markdown for ${url}`);
  }

  const max = opts?.maxCharacters;
  if (max != null && markdown.length > max) {
    markdown = markdown.slice(0, max);
  }

  const title = parsed.data?.metadata?.title?.trim() || undefined;
  return { url, markdown, title };
}
