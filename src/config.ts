export const config = {
  apiKey:
    process.env.AI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    "",
  defaultModel: process.env.AI_MODEL ?? "gemini-3.7-flash",
  notionToken:
    process.env.NOTION_TOKEN ??
    process.env.NOTION_API_KEY ??
    process.env.NOTION_PAT ??
    "",
  notionVersion: process.env.NOTION_VERSION ?? "2026-03-11",
  /** Exa API key for webfetch + websearch (`EXA_KEY`). */
  exaApiKey: process.env.EXA_KEY ?? process.env.EXA_API_KEY ?? "",
  /** HTTP/WS listen port for the cloud agent. */
  port: Number(process.env.PORT ?? 8787),
  /**
   * Shared secret for extension ↔ cloud.
   * When empty, auth is skipped (local dev only).
   */
  cloudToken: process.env.CLOUD_TOKEN ?? "",
} as const;

export function assertConfig() {
  if (!config.apiKey) {
    throw new Error("AI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is required");
  }
}
