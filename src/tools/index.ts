import { askUserTool } from "./ask-user.tool";
import { echoTool } from "./echo.tool";
import { emailVerifyTool } from "./email-verify.tool";
import {
  gmailDraftDiscardTool,
  gmailDraftFromTemplateTool,
  gmailDraftGetTool,
  gmailDraftListTool,
  gmailDraftSendNowTool,
  gmailDraftUpsertTool,
  gmailGetMessageTool,
  gmailListMessagesTool,
  gmailScheduleSendTool,
  gmailScoreImportanceTool,
  gmailSendTool,
  gmailStatusTool,
  gmailTemplateGetTool,
  gmailTemplateListTool,
  gmailTemplateUpsertTool,
} from "./gmail.tools";
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
import {
  cancelScheduledTaskTool,
  listScheduledTasksTool,
  scheduleTaskTool,
} from "./schedule.tools";
import {
  createWatcherTool,
  listWatchersTool,
  updateWatcherTool,
} from "./watcher.tools";
import { webfetchTool } from "./webfetch.tool";
import { websearchTool } from "./websearch.tool";
import type { AppTools } from "./types";

export * from "./types";

export const tools = {
  ask_user: askUserTool,
  echo: echoTool,
  email_verify: emailVerifyTool,
  webfetch: webfetchTool,
  websearch: websearchTool,
  schedule_task: scheduleTaskTool,
  list_scheduled_tasks: listScheduledTasksTool,
  cancel_scheduled_task: cancelScheduledTaskTool,
  create_watcher: createWatcherTool,
  list_watchers: listWatchersTool,
  update_watcher: updateWatcherTool,
  gmail_status: gmailStatusTool,
  gmail_list_messages: gmailListMessagesTool,
  gmail_get_message: gmailGetMessageTool,
  gmail_send: gmailSendTool,
  gmail_template_upsert: gmailTemplateUpsertTool,
  gmail_template_get: gmailTemplateGetTool,
  gmail_template_list: gmailTemplateListTool,
  gmail_draft_upsert: gmailDraftUpsertTool,
  gmail_draft_from_template: gmailDraftFromTemplateTool,
  gmail_draft_get: gmailDraftGetTool,
  gmail_draft_list: gmailDraftListTool,
  gmail_draft_discard: gmailDraftDiscardTool,
  gmail_draft_send_now: gmailDraftSendNowTool,
  gmail_schedule_send: gmailScheduleSendTool,
  gmail_score_importance: gmailScoreImportanceTool,
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
