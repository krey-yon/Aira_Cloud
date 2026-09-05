import { config } from "../config";

export const NOTION_API = "https://api.notion.com/v1";

export class NotionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "NotionError";
  }
}

export function assertNotionToken() {
  if (!config.notionToken) {
    throw new NotionError(
      "Notion is not authenticated. Set NOTION_TOKEN on the server (personal access token recommended for this assistant).",
      401,
      "unauthorized",
    );
  }
}

export function extractNotionId(input: string): string {
  const cleaned = input.trim();
  const match = cleaned.match(
    /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  const rawId = match?.[1];
  if (!rawId) {
    return cleaned;
  }

  const hex = rawId.replaceAll("-", "").toLowerCase();
  if (hex.length !== 32) {
    return cleaned;
  }

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function notionPageUrl(id: string): string {
  return `https://notion.so/${id.replaceAll("-", "")}`;
}

export function richTextPlain(items: unknown): string {
  if (!Array.isArray(items)) {
    return "";
  }

  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      const value = item as { plain_text?: string; text?: { content?: string } };
      return value.plain_text ?? value.text?.content ?? "";
    })
    .join("");
}

export function extractTitle(object: Record<string, unknown>): string {
  const properties = object.properties;
  if (properties && typeof properties === "object") {
    for (const value of Object.values(properties as Record<string, unknown>)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      const property = value as { type?: string; title?: unknown };
      if (property.type === "title") {
        return richTextPlain(property.title);
      }
    }
  }

  if (Array.isArray(object.title)) {
    return richTextPlain(object.title);
  }

  return "";
}

export function summarizeNotionObject(object: Record<string, unknown>) {
  return {
    id: object.id,
    object: object.object,
    title: extractTitle(object),
    url: typeof object.url === "string" ? object.url : notionPageUrl(String(object.id ?? "")),
    archived: Boolean(object.archived ?? object.in_trash),
    parent: object.parent,
    icon: object.icon,
    cover: object.cover,
    lastEditedTime: object.last_edited_time,
  };
}

type NotionRequestInit = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
};

export async function notionRequest<T>(
  path: string,
  init: NotionRequestInit = {},
): Promise<T> {
  assertNotionToken();

  const url = new URL(`${NOTION_API}${path}`);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  let attempt = 0;
  while (true) {
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${config.notionToken}`,
        "Notion-Version": config.notionVersion,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 1);
      await Bun.sleep(Math.max(retryAfter, 1) * 1000);
      attempt += 1;
      continue;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      object?: string;
      code?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new NotionError(
        payload.message ?? `Notion request failed (${response.status})`,
        response.status,
        payload.code,
      );
    }

    return payload as T;
  }
}

export function toolError(error: unknown) {
  if (error instanceof NotionError) {
    return {
      ok: false as const,
      status: error.status,
      code: error.code,
      error: error.message,
    };
  }

  return {
    ok: false as const,
    error: error instanceof Error ? error.message : "Unknown Notion error",
  };
}
