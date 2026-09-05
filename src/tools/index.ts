import { echoTool } from "./echo.tool";
import { emailVerifyTool } from "./email-verify.tool";
import {
  notionCreateDatabaseTool,
  notionCreatePageTool,
  notionQueryDatabaseTool,
  notionReadDatabaseTool,
  notionReadPageTool,
  notionSearchTool,
  notionUpdatePageTool,
  notionWhoamiTool,
  notionWritePageTool,
} from "./notion.tools";
import { webfetchTool } from "./webfetch.tool";
import { websearchTool } from "./websearch.tool";
import type { AppTools } from "./types";

export * from "./types";

export const tools = {
  echo: echoTool,
  email_verify: emailVerifyTool,
  webfetch: webfetchTool,
  websearch: websearchTool,
  notion_whoami: notionWhoamiTool,
  notion_search: notionSearchTool,
  notion_read_page: notionReadPageTool,
  notion_read_database: notionReadDatabaseTool,
  notion_query_database: notionQueryDatabaseTool,
  notion_create_page: notionCreatePageTool,
  notion_update_page: notionUpdatePageTool,
  notion_write_page: notionWritePageTool,
  notion_create_database: notionCreateDatabaseTool,
} satisfies AppTools;

export function getTools(): AppTools {
  return tools;
}
