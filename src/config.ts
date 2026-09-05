export const config = {
  /**
   * Legacy Google key — kept only as a soft fallback if Cloudflare creds are absent.
   * Prefer CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
   */
  apiKey:
    process.env.AI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    "",
  /**
   * Workers AI model id, e.g. @cf/qwen/qwen3-30b-a3b-fp8
   */
  defaultModel:
    process.env.AI_MODEL ??
    process.env.CLOUD_FLARE_AI_MODEL ??
    process.env.CLOUDFLARE_AI_MODEL ??
    "@cf/qwen/qwen3-30b-a3b-fp8",
  /** Cloudflare account id for Workers AI REST. */
  cloudflareAccountId:
    process.env.CLOUDFLARE_ACCOUNT_ID ??
    process.env.CLOUD_ACCOUNT_ID ??
    "",
  /** Cloudflare API token (Workers AI). */
  cloudflareApiToken:
    process.env.CLOUDFLARE_API_TOKEN ??
    process.env.CLOUDFLARE_AI_WORKER ??
    "",
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
  /** SQLite path for durable scheduled tasks. */
  schedulerDbPath:
    process.env.SCHEDULER_DB ??
    `${process.cwd()}/data/scheduler.sqlite`,
  /** SQLite path for proactive watchers. */
  watchersDbPath:
    process.env.WATCHERS_DB ??
    `${process.cwd()}/data/watchers.sqlite`,
  /** SQLite path for watcher notification queue. */
  notifyDbPath:
    process.env.NOTIFY_DB ??
    `${process.cwd()}/data/notify.sqlite`,
  /** Resend API key for cloud-sent watcher emails (`RESEND` or `RESEND_API_KEY`). */
  resendApiKey: process.env.RESEND ?? process.env.RESEND_API_KEY ?? "",
  /** From header for watcher emails. */
  resendFrom:
    process.env.RESEND_FROM ??
    "Aira <aira@kreyon.in>",
  /** Constant destination for watcher alerts. */
  notifyEmail:
    process.env.AIRA_NOTIFY_EMAIL ??
    "kushwaha.k.vikas@gmail.com",
  /** How often the watcher runner ticks (ms). */
  watcherTickMs: Number(process.env.WATCHER_TICK_MS ?? 15_000),
  /** SQLite path for Gmail OAuth tokens. */
  gmailDbPath:
    process.env.GMAIL_DB ??
    `${process.cwd()}/data/gmail.sqlite`,
  /** SQLite path for long answer canvases opened from the extension. */
  canvasDbPath:
    process.env.CANVAS_DB ??
    `${process.cwd()}/data/canvas.sqlite`,
  /**
   * Public origin for canvas links shown in the extension.
   * Production default: https://aira.kreyon.in
   */
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL ??
    process.env.AIRA_PUBLIC_URL ??
    "",
  /** Answers longer than this word count open on the canvas instead of the widget. */
  canvasWordCap: Number(process.env.CANVAS_WORD_CAP ?? 120),
  /** Google OAuth client for Gmail send/read. */
  googleClientId: process.env.CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "",
  /**
   * Must match an Authorized redirect URI in Google Cloud Console.
   * Local example: http://localhost:7777/auth/gmail/callback
   */
  gmailRedirectUri:
    process.env.REDIRECT_URI ??
    process.env.GMAIL_REDIRECT_URI ??
    "",
  /** How often to poll for due tasks (ms). */
  schedulerTickMs: Number(process.env.SCHEDULER_TICK_MS ?? 1000),
  /**
   * Redis URL for collected error KV storage.
   * Falls back to Bun's default (`REDIS_URL` / localhost) when empty.
   */
  redisUrl: process.env.REDIS_URL ?? "",
} as const;

export function assertConfig() {
  if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or CLOUDFLARE_AI_WORKER) are required",
    );
  }
}
