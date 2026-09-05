import { tool } from "ai";
import { z } from "zod";

import { config } from "../config";
import {
  extractNotionId,
  extractTitle,
  notionPageUrl,
  notionRequest,
  summarizeNotionObject,
  toolError,
} from "../lib/notion";

const idSchema = z
  .string()
  .describe("Notion page, database, or block ID, or a Notion URL");

const iconSchema = z
  .object({
    emoji: z.string().optional().describe("Emoji icon, e.g. 📓"),
    name: z.string().optional().describe("Native Notion icon name, e.g. home, meeting, pizza"),
    color: z
      .string()
      .optional()
      .describe("Native icon color: gray, lightgray, brown, yellow, orange, green, blue, purple, pink, red"),
    url: z.string().optional().describe("External icon image URL"),
  })
  .optional();

function buildIcon(icon?: {
  emoji?: string;
  name?: string;
  color?: string;
  url?: string;
}) {
  if (!icon) {
    return undefined;
  }
  if (icon.emoji) {
    return { type: "emoji", emoji: icon.emoji };
  }
  if (icon.url) {
    return { type: "external", external: { url: icon.url } };
  }
  if (icon.name) {
    return {
      type: "icon",
      icon: {
        name: icon.name,
        ...(icon.color ? { color: icon.color } : {}),
      },
    };
  }
  return undefined;
}

function buildCover(url?: string) {
  if (!url) {
    return undefined;
  }
  return { type: "external", external: { url } };
}

function defaultParentPageId(): string | undefined {
  const raw = config.notionParentPageId;
  return raw ? extractNotionId(raw) : undefined;
}

function buildParent(input: {
  parentPageId?: string;
  parentDatabaseId?: string;
  workspace?: boolean;
}) {
  if (input.parentDatabaseId) {
    return { type: "database_id", database_id: extractNotionId(input.parentDatabaseId) };
  }
  if (input.parentPageId) {
    return { type: "page_id", page_id: extractNotionId(input.parentPageId) };
  }
  // Explicit workspace request only — otherwise prefer NOTION_PADE_ID.
  if (input.workspace === true) {
    return { type: "workspace", workspace: true };
  }
  const configured = defaultParentPageId();
  if (configured) {
    return { type: "page_id", page_id: configured };
  }
  if (input.workspace !== false) {
    return { type: "workspace", workspace: true };
  }
  return undefined;
}

export const notionWhoamiTool = tool({
  description:
    "Verify Notion authentication and return the authorized bot/user. Call this first if a Notion request fails with 401.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const me = await notionRequest<Record<string, unknown>>("/users/me");
      return { ok: true, user: me };
    } catch (error) {
      return toolError(error);
    }
  },
});

export const notionSearchTool = tool({
  description:
    "Search the Notion workspace by title. Use this to find pages or databases before reading or editing them.",
  inputSchema: z.object({
    query: z.string().describe("Title search text"),
    filter: z
      .enum(["page", "database"])
      .optional()
      .describe("Limit results to pages or databases"),
    pageSize: z.number().int().min(1).max(100).optional(),
  }),
  execute: async ({ query, filter, pageSize }) => {
    try {
      const result = await notionRequest<{
        results?: Record<string, unknown>[];
        has_more?: boolean;
        next_cursor?: string | null;
      }>("/search", {
        method: "POST",
        body: {
          query,
          page_size: pageSize ?? 20,
          ...(filter
            ? { filter: { value: filter, property: "object" } }
            : {}),
        },
      });

      return {
        ok: true,
        hasMore: Boolean(result.has_more),
        nextCursor: result.next_cursor ?? null,
        results: (result.results ?? []).map(summarizeNotionObject),
      };
    } catch (error) {
      return toolError(error);
    }
  },
});

export const notionReadPageTool = tool({
  description:
    "Read a Notion page: properties plus the body as enhanced markdown. Prefer this over raw blocks.",
  inputSchema: z.object({
    pageId: idSchema,
    includeTranscript: z.boolean().optional(),
  }),
  execute: async ({ pageId, includeTranscript }) => {
    try {
      const id = extractNotionId(pageId);
      const [page, markdown] = await Promise.all([
        notionRequest<Record<string, unknown>>(`/pages/${id}`),
        notionRequest<{
          markdown?: string;
          truncated?: boolean;
          unknown_block_ids?: string[];
        }>(`/pages/${id}/markdown`, {
          query: includeTranscript ? { include_transcript: "true" } : {},
        }),
      ]);

      return {
        ok: true,
        page: {
          ...summarizeNotionObject(page),
          properties: page.properties,
        },
        markdown: markdown.markdown ?? "",
        truncated: Boolean(markdown.truncated),
        unknownBlockIds: markdown.unknown_block_ids ?? [],
      };
    } catch (error) {
      return toolError(error);
    }
  },
});

export const notionReadDatabaseTool = tool({
  description:
    "Read a Notion database schema (title, properties, and URL). Call this before creating rows or querying.",
  inputSchema: z.object({
    databaseId: idSchema,
  }),
  execute: async ({ databaseId }) => {
    try {
      const database = await notionRequest<Record<string, unknown>>(
        `/databases/${extractNotionId(databaseId)}`,
      );
      return {
        ok: true,
        database: {
          ...summarizeNotionObject(database),
          title: extractTitle(database),
          properties: database.properties,
        },
      };
    } catch (error) {
      return toolError(error);
    }
  },
});

export const notionQueryDatabaseTool = tool({
  description:
    "Query rows in a Notion database with optional filter and sorts. Property names must match the schema exactly.",
  inputSchema: z.object({
    databaseId: idSchema,
    filter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Notion filter object, e.g. { property: 'Status', select: { equals: 'Done' } }"),
    sorts: z
      .array(z.record(z.string(), z.unknown()))
      .optional()
      .describe("Notion sorts array"),
    pageSize: z.number().int().min(1).max(100).optional(),
    startCursor: z.string().optional(),
  }),
  execute: async ({ databaseId, filter, sorts, pageSize, startCursor }) => {
    try {
      const result = await notionRequest<{
        results?: Record<string, unknown>[];
        has_more?: boolean;
        next_cursor?: string | null;
      }>(`/databases/${extractNotionId(databaseId)}/query`, {
        method: "POST",
        body: {
          page_size: pageSize ?? 50,
          ...(filter ? { filter } : {}),
          ...(sorts ? { sorts } : {}),
          ...(startCursor ? { start_cursor: startCursor } : {}),
        },
      });

      return {
        ok: true,
        hasMore: Boolean(result.has_more),
        nextCursor: result.next_cursor ?? null,
        results: (result.results ?? []).map((row) => ({
          ...summarizeNotionObject(row),
          properties: row.properties,
        })),
      };
    } catch (error) {
      return toolError(error);
    }
  },
});

export const notionCreatePageTool = tool({
  description:
    "Create a Notion page under the configured Aira parent (NOTION_PADE_ID) by default. Prefer enhanced markdown for the body. Pass parentPageId/parentDatabaseId only to override; set workspace true for a private workspace page.",
  inputSchema: z.object({
    title: z.string().optional().describe("Page title. If omitted, the first # heading in markdown is used."),
    markdown: z
      .string()
      .optional()
      .describe("Enhanced Notion markdown for the page body. Do not also send children."),
    parentPageId: z
      .string()
      .optional()
      .describe("Override parent page. Omit to use NOTION_PADE_ID."),
    parentDatabaseId: z.string().optional(),
    workspace: z
      .boolean()
      .optional()
      .describe("If true, create a private workspace-level page instead of using NOTION_PADE_ID."),
    icon: iconSchema,
    coverUrl: z.string().optional().describe("External cover image URL"),
    properties: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Database property values when creating a row. Keys must match the schema."),
  }),
  execute: async (input) => {
    try {
      const parent = buildParent(input);
      const titleProperty = input.title
        ? {
            title: {
              title: [{ type: "text", text: { content: input.title } }],
            },
          }
        : {};

      const body: Record<string, unknown> = {
        ...(parent ? { parent } : {}),
        properties: {
          ...titleProperty,
          ...(input.properties ?? {}),
        },
      };

      const icon = buildIcon(input.icon);
      const cover = buildCover(input.coverUrl);
      if (icon) {
        body.icon = icon;
      }
      if (cover) {
        body.cover = cover;
      }
      if (input.markdown) {
        body.markdown = input.markdown;
      }

      const page = await notionRequest<Record<string, unknown>>("/pages", {
        method: "POST",
        body,
      });

      if (page.object === "async_task") {
        return { ok: true, async: true, task: page };
      }

      return {
        ok: true,
        page: summarizeNotionObject(page),
        url: typeof page.url === "string" ? page.url : notionPageUrl(String(page.id ?? "")),
      };
    } catch (error) {
      return toolError(error);
    }
  },
});

export const notionUpdatePageTool = tool({
  description:
    "Update a Notion page's title, properties, icon, cover, or archive/restore it. Does not change body content.",
  inputSchema: z.object({
    pageId: idSchema,
    title: z.string().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    icon: iconSchema,
    coverUrl: z.string().optional(),
    archived: z.boolean().optional().describe("true moves the page to Trash; false restores it"),
  }),
  execute: async (input) => {
    try {
      const body: Record<string, unknown> = {};
      const properties: Record<string, unknown> = { ...(input.properties ?? {}) };
      if (input.title) {
        properties.title = {
          title: [{ type: "text", text: { content: input.title } }],
        };
      }
      if (Object.keys(properties).length > 0) {
        body.properties = properties;
      }
      const icon = buildIcon(input.icon);
      const cover = buildCover(input.coverUrl);
      if (icon) {
        body.icon = icon;
      }
      if (cover) {
        body.cover = cover;
      }
      if (input.archived !== undefined) {
        body.archived = input.archived;
      }

      const page = await notionRequest<Record<string, unknown>>(
        `/pages/${extractNotionId(input.pageId)}`,
        { method: "PATCH", body },
      );

      return {
        ok: true,
        page: summarizeNotionObject(page),
        url: typeof page.url === "string" ? page.url : notionPageUrl(String(page.id ?? "")),
      };
    } catch (error) {
      return toolError(error);
    }
  },
});

export const notionWritePageTool = tool({
  description:
    "Edit a Notion page body with enhanced markdown. Use update for search-and-replace, replace to rewrite the page, or insert to add content.",
  inputSchema: z.object({
    pageId: idSchema,
    action: z.enum(["update", "replace", "insert"]),
    markdown: z
      .string()
      .optional()
      .describe("New markdown for replace or insert"),
    replacements: z
      .array(
        z.object({
          oldStr: z.string().describe("Exact existing text to find"),
          newStr: z.string().describe("Replacement markdown"),
          replaceAll: z.boolean().optional(),
        }),
      )
      .optional()
      .describe("Required for action=update"),
    position: z
      .enum(["start", "end"])
      .optional()
      .describe("Insert position. Defaults to end."),
    allowDeletingContent: z
      .boolean()
      .optional()
      .describe("Allow deleting child pages/databases during replace/update"),
  }),
  execute: async (input) => {
    try {
      let body: Record<string, unknown>;

      if (input.action === "update") {
        if (!input.replacements?.length) {
          return {
            ok: false,
            error: "action=update requires replacements with oldStr/newStr.",
          };
        }
        body = {
          type: "update_content",
          update_content: {
            content_updates: input.replacements.map((item) => ({
              old_str: item.oldStr,
              new_str: item.newStr,
              ...(item.replaceAll ? { replace_all_matches: true } : {}),
            })),
            ...(input.allowDeletingContent
              ? { allow_deleting_content: true }
              : {}),
          },
        };
      } else if (input.action === "replace") {
        if (!input.markdown) {
          return { ok: false, error: "action=replace requires markdown." };
        }
        body = {
          type: "replace_content",
          replace_content: {
            new_str: input.markdown,
            ...(input.allowDeletingContent
              ? { allow_deleting_content: true }
              : {}),
          },
        };
      } else {
        if (!input.markdown) {
          return { ok: false, error: "action=insert requires markdown." };
        }
        body = {
          type: "insert_content",
          insert_content: {
            content: input.markdown,
            position: { type: input.position ?? "end" },
          },
        };
      }

      const result = await notionRequest<{
        markdown?: string;
        truncated?: boolean;
        unknown_block_ids?: string[];
        object?: string;
      }>(`/pages/${extractNotionId(input.pageId)}/markdown`, {
        method: "PATCH",
        body,
      });

      if (result.object === "async_task") {
        return { ok: true, async: true, task: result };
      }

      return {
        ok: true,
        url: notionPageUrl(extractNotionId(input.pageId)),
        markdown: result.markdown ?? "",
        truncated: Boolean(result.truncated),
        unknownBlockIds: result.unknown_block_ids ?? [],
      };
    } catch (error) {
      return toolError(error);
    }
  },
});

export const notionCreateDatabaseTool = tool({
  description:
    "Create a Notion database under the configured Aira parent (NOTION_PADE_ID) by default. Exactly one title property is required. Pass parentPageId to override; set workspace true for a private workspace database.",
  inputSchema: z.object({
    title: z.string(),
    parentPageId: z
      .string()
      .optional()
      .describe("Override parent page. Omit to use NOTION_PADE_ID."),
    workspace: z
      .boolean()
      .optional()
      .describe("If true, create a private workspace database instead of using NOTION_PADE_ID."),
    properties: z
      .record(z.string(), z.unknown())
      .describe(
        'Schema map. Must include one title property, e.g. { Name: { title: {} }, Status: { select: { options: [{ name: "Todo", color: "gray" }] } } }',
      ),
  }),
  execute: async (input) => {
    try {
      const parent = buildParent({
        parentPageId: input.parentPageId,
        workspace: input.workspace,
      });

      const database = await notionRequest<Record<string, unknown>>("/databases", {
        method: "POST",
        body: {
          parent,
          title: [{ type: "text", text: { content: input.title } }],
          properties: input.properties,
        },
      });

      return {
        ok: true,
        database: {
          ...summarizeNotionObject(database),
          properties: database.properties,
        },
        url:
          typeof database.url === "string"
            ? database.url
            : notionPageUrl(String(database.id ?? "")),
      };
    } catch (error) {
      return toolError(error);
    }
  },
});
