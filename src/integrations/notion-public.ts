import { extractNotionId, notionPageUrl } from "./notion";

const NOTION_PUBLIC_API = "https://www.notion.so/api/v3";
const NOTION_CLIENT_VERSION = "23.13.0.32";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class NotionPublicError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "NotionPublicError";
  }
}

export type PublicAccessVerdict =
  | "public"
  | "login-required"
  | "not-public"
  | "deleted"
  | "not-found"
  | "unknown";

export type NotionPublicAccess = {
  verdict: PublicAccessVerdict;
  publicAccessRole: string | null;
  requireLogin: boolean;
  isPublicShareLink: boolean;
  isDeleted: boolean;
  canRequestAccess: boolean;
  isEditableOrCommentableSite: boolean;
};

export type NotionPublicIdentity = {
  pageId: string;
  canonicalUrl: string;
  spaceName: string | null;
  spaceDomain: string | null;
  spaceShortId: string | null;
  publicDomainName: string | null;
  title: string | null;
  icon: string | null;
  cover: string | null;
};

export type NotionPublicOutlineItem = {
  type: string;
  count: number;
};

export type NotionPublicContent = {
  title: string | null;
  icon: string | null;
  cover: string | null;
  createdTime: string | null;
  lastEditedTime: string | null;
  updatedAgo: string | null;
  createdAgo: string | null;
  blockCount: number;
  childPageCount: number;
  childDatabaseCount: number;
  outline: NotionPublicOutlineItem[];
};

export type NotionPublicOg = {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
};

export type NotionPublicTemplate = {
  name: string | null;
  slug: string | null;
  creatorName: string | null;
  creatorUsername: string | null;
  isPaid: boolean | null;
  imageUrl: string | null;
};

export type NotionPublicDossier = {
  ok: true;
  input: { url?: string; pageId?: string; resolvedPageId: string };
  access: NotionPublicAccess;
  identity: NotionPublicIdentity;
  content: NotionPublicContent | null;
  og: NotionPublicOg | null;
  template: NotionPublicTemplate | null;
  warnings: string[];
};

type PublicPageData = {
  pageId?: string;
  spaceName?: string;
  spaceId?: string;
  spaceDomain?: string;
  spaceShortId?: string;
  publicDomainName?: string;
  requireLogin?: boolean;
  publicAccessRole?: string;
  canRequestAccess?: boolean;
  isDeleted?: boolean;
  isPublicShareLink?: boolean;
  isEditableOrCommentableSite?: boolean;
  requireInterstitial?: string;
  template?: {
    name?: string;
    slug?: string;
    creator?: { name?: string; username?: string };
    isPaid?: boolean;
    imageUrl?: string;
  };
  message?: string;
};

type NotionBlockValue = {
  id?: string;
  type?: string;
  properties?: Record<string, unknown>;
  format?: Record<string, unknown>;
  content?: string[];
  created_time?: number;
  last_edited_time?: number;
  alive?: boolean;
};

/**
 * Notion public recordMap entries are usually `{ spaceId, value: { value: Block, role } }`.
 * Older/simpler fixtures may be `{ value: Block }` or the Block itself.
 */
type RecordMapBlock = {
  spaceId?: string;
  value?: NotionBlockValue | { value?: NotionBlockValue; role?: string };
  role?: string;
};

function unwrapBlockValue(entry: RecordMapBlock | undefined): NotionBlockValue | undefined {
  if (!entry) return undefined;
  const outer = entry.value;
  if (!outer || typeof outer !== "object") return undefined;
  if ("value" in outer && outer.value && typeof outer.value === "object") {
    return outer.value as NotionBlockValue;
  }
  if ("type" in outer || "last_edited_time" in outer || "properties" in outer) {
    return outer as NotionBlockValue;
  }
  return undefined;
}

export type ParsedNotionPublicInput = {
  pageId: string;
  sourceUrl: string | null;
  spaceDomain: string | null;
};

export function parseNotionPublicInput(input: string): ParsedNotionPublicInput {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new NotionPublicError("Provide a Notion URL or page id", 400, "invalid_input");
  }

  let spaceDomain: string | null = null;
  let sourceUrl: string | null = null;
  let candidate = trimmed;

  try {
    const withScheme =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : trimmed.includes("notion.so") || trimmed.includes("notion.site")
          ? `https://${trimmed}`
          : trimmed;

    if (withScheme.startsWith("http://") || withScheme.startsWith("https://")) {
      const url = new URL(withScheme);
      sourceUrl = url.toString();
      const host = url.hostname.toLowerCase();

      if (host.endsWith(".notion.site")) {
        spaceDomain = host.replace(/\.notion\.site$/i, "") || null;
      }

      const p = url.searchParams.get("p") ?? url.searchParams.get("pageId");
      if (p && /[0-9a-f]{32}|[0-9a-f-]{36}/i.test(p)) {
        candidate = p;
      } else {
        candidate = `${url.pathname}${url.search}`;
      }
    }
  } catch {
    // Not a URL — treat as raw id / slug-id string.
  }

  const pageId = extractNotionId(candidate);
  const hex = pageId.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    throw new NotionPublicError(
      "Could not find a Notion page id in that input. Paste a notion.so / notion.site URL or a 32-character page id.",
      400,
      "invalid_page_id",
    );
  }

  return {
    pageId: extractNotionId(hex),
    sourceUrl,
    spaceDomain,
  };
}

export function formatUpdatedAgo(
  input: string | number | Date | null | undefined,
  nowMs = Date.now(),
): string | null {
  if (input == null) return null;
  const ms =
    input instanceof Date
      ? input.getTime()
      : typeof input === "number"
        ? input
        : Date.parse(input);
  if (!Number.isFinite(ms)) return null;

  const delta = nowMs - ms;
  if (delta < 0) {
    // Future timestamp — still report absolute-ish relative.
    const ahead = Math.abs(delta);
    if (ahead < 60_000) return "just now";
    return formatDuration(ahead) + " from now";
  }
  if (delta < 1000) return "just now";
  return `${formatDuration(delta)} ago`;
}

function formatDuration(absMs: number): string {
  const sec = Math.round(absMs / 1000);
  if (sec < 60) return `${Math.max(1, sec)} sec`;

  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;

  const hour = Math.round(min / 60);
  if (hour < 48) return hour === 1 ? "1 hour" : `${hour} hours`;

  const day = Math.round(hour / 24);
  if (day < 45) return day === 1 ? "1 day" : `${day} days`;

  const month = Math.round(day / 30);
  if (month < 18) return month === 1 ? "1 month" : `${month} months`;

  const year = Math.max(1, Math.round(day / 365));
  return year === 1 ? "1 year" : `${year} years`;
}

function toIsoFromNotionTime(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // Notion public recordMap uses epoch ms; guard against seconds.
  const ms = value < 1e12 ? value * 1000 : value;
  const date = new Date(ms);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function richTitle(properties: Record<string, unknown> | undefined): string | null {
  if (!properties) return null;
  const title = properties.title;
  if (!Array.isArray(title)) return null;
  const parts: string[] = [];
  for (const segment of title) {
    if (Array.isArray(segment) && typeof segment[0] === "string") {
      parts.push(segment[0]);
    }
  }
  const joined = parts.join("").trim();
  return joined || null;
}

function formatIcon(format: Record<string, unknown> | undefined): string | null {
  if (!format) return null;
  const icon = format.page_icon;
  return typeof icon === "string" && icon.trim() ? icon.trim() : null;
}

function formatCover(format: Record<string, unknown> | undefined): string | null {
  if (!format) return null;
  const cover = format.page_cover;
  return typeof cover === "string" && cover.trim() ? cover.trim() : null;
}

function verdictFromPublicData(data: PublicPageData): PublicAccessVerdict {
  if (data.isDeleted) return "deleted";
  if (data.requireLogin) return "login-required";
  const role = (data.publicAccessRole ?? "none").toLowerCase();
  if (role === "none" || role === "") return "not-public";
  if (role === "reader" || role === "editor" || role === "comment_only") return "public";
  return "unknown";
}

function isReadableRole(role: string | null | undefined): boolean {
  const normalized = (role ?? "").toLowerCase();
  return normalized === "reader" || normalized === "editor" || normalized === "comment_only";
}

async function notionPublicPost<T>(path: string, body: unknown): Promise<T> {
  let attempt = 0;
  while (true) {
    const response = await fetch(`${NOTION_PUBLIC_API}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        "notion-client-version": NOTION_CLIENT_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 1);
      await Bun.sleep(Math.max(retryAfter, 1) * 1000);
      attempt += 1;
      continue;
    }

    const payload = (await response.json().catch(() => ({}))) as T & {
      message?: string;
      errorId?: string;
    };

    if (!response.ok) {
      throw new NotionPublicError(
        payload.message ?? `Notion public API failed (${response.status})`,
        response.status,
        response.status === 404 ? "not_found" : undefined,
      );
    }

    return payload;
  }
}

export async function getPublicPageData(blockId: string): Promise<PublicPageData> {
  return notionPublicPost<PublicPageData>("getPublicPageData", {
    type: "block-space",
    blockId,
  });
}

export async function loadPublicPageChunk(pageId: string, limit = 50) {
  return notionPublicPost<{
    recordMap?: { block?: Record<string, RecordMapBlock> };
  }>("loadCachedPageChunkV2", {
    page: { id: pageId },
    limit,
    cursor: { stack: [] },
    chunkNumber: 0,
    verticalColumns: false,
  });
}

function buildCanonicalUrl(
  pageId: string,
  spaceDomain: string | null,
  publicDomainName: string | null,
  sourceUrl: string | null,
  interstitial: string | undefined,
): string {
  if (interstitial && /^https?:\/\//i.test(interstitial)) return interstitial;
  if (sourceUrl) return sourceUrl;
  const domain = publicDomainName || spaceDomain;
  if (domain) {
    return `https://${domain}.notion.site/${pageId.replaceAll("-", "")}`;
  }
  return notionPageUrl(pageId);
}

function summarizeContent(
  pageId: string,
  recordMap: { block?: Record<string, RecordMapBlock> } | undefined,
  nowMs: number,
): NotionPublicContent | null {
  const blocks = recordMap?.block;
  if (!blocks || Object.keys(blocks).length === 0) return null;

  const root = unwrapBlockValue(blocks[pageId]);
  const typeCounts = new Map<string, number>();
  let childPageCount = 0;
  let childDatabaseCount = 0;

  for (const [id, entry] of Object.entries(blocks)) {
    const value = unwrapBlockValue(entry);
    const type = value?.type ?? "unknown";
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    if (type === "page" && (value?.id ?? id) !== pageId) childPageCount += 1;
    if (type === "collection_view_page" || type === "collection_view") {
      childDatabaseCount += 1;
    }
  }

  const outline = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const createdTime = toIsoFromNotionTime(root?.created_time);
  const lastEditedTime = toIsoFromNotionTime(root?.last_edited_time);

  return {
    title: richTitle(root?.properties) ?? null,
    icon: formatIcon(root?.format),
    cover: formatCover(root?.format),
    createdTime,
    lastEditedTime,
    updatedAgo: formatUpdatedAgo(lastEditedTime, nowMs),
    createdAgo: formatUpdatedAgo(createdTime, nowMs),
    blockCount: Object.keys(blocks).length,
    childPageCount,
    childDatabaseCount,
    outline,
  };
}

function parseOgTags(html: string): NotionPublicOg {
  const read = (prop: string): string | null => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      "i",
    );
    return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null;
  };

  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;

  return {
    title: read("og:title") ?? titleTag,
    description: read("og:description") ?? read("description"),
    image: read("og:image"),
    url: read("og:url"),
  };
}

export async function fetchPublicOg(url: string): Promise<NotionPublicOg | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
    });
    if (!response.ok) return null;
    const html = await response.text();
    const og = parseOgTags(html);
    if (!og.title && !og.description && !og.image) return null;
    return og;
  } catch {
    return null;
  }
}

export async function analyzePublicNotionPage(options: {
  url?: string;
  pageId?: string;
  nowMs?: number;
  includeOgFallback?: boolean;
}): Promise<NotionPublicDossier> {
  const raw = options.url?.trim() || options.pageId?.trim();
  if (!raw) {
    throw new NotionPublicError("Provide url or pageId", 400, "invalid_input");
  }

  const parsed = parseNotionPublicInput(raw);
  const nowMs = options.nowMs ?? Date.now();
  const warnings: string[] = [];

  let publicData: PublicPageData;
  try {
    publicData = await getPublicPageData(parsed.pageId);
  } catch (error) {
    if (error instanceof NotionPublicError && error.status === 404) {
      return {
        ok: true,
        input: {
          url: options.url,
          pageId: options.pageId,
          resolvedPageId: parsed.pageId,
        },
        access: {
          verdict: "not-found",
          publicAccessRole: null,
          requireLogin: false,
          isPublicShareLink: false,
          isDeleted: false,
          canRequestAccess: false,
          isEditableOrCommentableSite: false,
        },
        identity: {
          pageId: parsed.pageId,
          canonicalUrl: parsed.sourceUrl ?? notionPageUrl(parsed.pageId),
          spaceName: null,
          spaceDomain: parsed.spaceDomain,
          spaceShortId: null,
          publicDomainName: null,
          title: null,
          icon: null,
          cover: null,
        },
        content: null,
        og: null,
        template: null,
        warnings: ["Page was not found via Notion public API."],
      };
    }
    throw error;
  }

  const resolvedPageId = publicData.pageId
    ? extractNotionId(publicData.pageId)
    : parsed.pageId;
  const verdict = verdictFromPublicData(publicData);
  const spaceDomain = publicData.spaceDomain ?? parsed.spaceDomain;
  const canonicalUrl = buildCanonicalUrl(
    resolvedPageId,
    spaceDomain,
    publicData.publicDomainName ?? null,
    parsed.sourceUrl,
    publicData.requireInterstitial,
  );

  let content: NotionPublicContent | null = null;
  if (isReadableRole(publicData.publicAccessRole) && !publicData.requireLogin && !publicData.isDeleted) {
    try {
      const chunk = await loadPublicPageChunk(resolvedPageId);
      content = summarizeContent(resolvedPageId, chunk.recordMap, nowMs);
      if (!content) {
        warnings.push("Public chunk loaded but contained no blocks.");
      } else if (!content.lastEditedTime) {
        warnings.push("Public content did not expose a last_edited_time.");
      }
    } catch (error) {
      warnings.push(
        `Could not load public page content: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  } else if (verdict === "login-required") {
    warnings.push("Page requires login; public content was not fetched.");
  } else if (verdict === "not-public") {
    warnings.push("Page is not publicly readable; only sharing posture is available.");
  } else if (verdict === "deleted") {
    warnings.push("Page is marked deleted in the public API.");
  }

  let og: NotionPublicOg | null = null;
  const wantOg =
    options.includeOgFallback !== false &&
    (!content?.title || verdict === "login-required" || verdict === "not-public");
  if (wantOg) {
    og = await fetchPublicOg(canonicalUrl);
    if (!og) {
      warnings.push("OG/HTML fallback returned no metadata.");
    }
  }

  const template = publicData.template
    ? {
        name: publicData.template.name ?? null,
        slug: publicData.template.slug ?? null,
        creatorName: publicData.template.creator?.name ?? null,
        creatorUsername: publicData.template.creator?.username ?? null,
        isPaid: publicData.template.isPaid ?? null,
        imageUrl: publicData.template.imageUrl ?? null,
      }
    : null;

  return {
    ok: true,
    input: {
      url: options.url,
      pageId: options.pageId,
      resolvedPageId,
    },
    access: {
      verdict,
      publicAccessRole: publicData.publicAccessRole ?? null,
      requireLogin: Boolean(publicData.requireLogin),
      isPublicShareLink: Boolean(publicData.isPublicShareLink),
      isDeleted: Boolean(publicData.isDeleted),
      canRequestAccess: Boolean(publicData.canRequestAccess),
      isEditableOrCommentableSite: Boolean(publicData.isEditableOrCommentableSite),
    },
    identity: {
      pageId: resolvedPageId,
      canonicalUrl,
      spaceName: publicData.spaceName ?? null,
      spaceDomain,
      spaceShortId: publicData.spaceShortId ?? null,
      publicDomainName: publicData.publicDomainName ?? null,
      title: content?.title ?? og?.title ?? template?.name ?? null,
      icon: content?.icon ?? null,
      cover: content?.cover ?? null,
    },
    content,
    og,
    template,
    warnings,
  };
}

export async function getPublicNotionLastUpdated(options: {
  url?: string;
  pageId?: string;
  nowMs?: number;
}): Promise<{
  ok: true;
  pageId: string;
  canonicalUrl: string;
  title: string | null;
  verdict: PublicAccessVerdict;
  lastEditedTime: string | null;
  updatedAgo: string | null;
  createdTime: string | null;
  createdAgo: string | null;
  available: boolean;
  message: string;
}> {
  const dossier = await analyzePublicNotionPage({
    ...options,
    includeOgFallback: false,
  });

  const lastEditedTime = dossier.content?.lastEditedTime ?? null;
  const updatedAgo = dossier.content?.updatedAgo ?? null;
  const available = Boolean(lastEditedTime);

  let message: string;
  if (dossier.access.verdict === "deleted") {
    message = "Page is deleted; no public last-updated time.";
  } else if (dossier.access.verdict === "login-required") {
    message = "Page requires login; last-updated time is not publicly visible.";
  } else if (dossier.access.verdict === "not-public" || dossier.access.verdict === "not-found") {
    message = "Page is not publicly readable; last-updated time is not available.";
  } else if (!available) {
    message = "Page is public but Notion did not expose a last_edited_time in the public record map.";
  } else {
    const title = dossier.identity.title ? `“${dossier.identity.title}”` : "This Notion page";
    message = `${title} was last updated ${updatedAgo} (${lastEditedTime}).`;
  }

  return {
    ok: true,
    pageId: dossier.identity.pageId,
    canonicalUrl: dossier.identity.canonicalUrl,
    title: dossier.identity.title,
    verdict: dossier.access.verdict,
    lastEditedTime,
    updatedAgo,
    createdTime: dossier.content?.createdTime ?? null,
    createdAgo: dossier.content?.createdAgo ?? null,
    available,
    message,
  };
}

export function toolError(error: unknown) {
  if (error instanceof NotionPublicError) {
    return {
      ok: false as const,
      status: error.status,
      code: error.code,
      error: error.message,
    };
  }

  return {
    ok: false as const,
    error: error instanceof Error ? error.message : "Unknown Notion public API error",
  };
}
