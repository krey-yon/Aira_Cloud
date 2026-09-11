import type { SkillRecord } from "./types";

const CORE_TOOLS = [
  "ask_user",
  "websearch",
  "webfetch",
  "schedule_task",
  "list_scheduled_tasks",
  "cancel_scheduled_task",
  "create_watcher",
  "list_watchers",
  "update_watcher",
] as const;

const NOTION_TOOLS = [
  "ask_user",
  "notion_whoami",
  "notion_search",
  "notion_read_page",
  "notion_read_database",
  "notion_query_database",
  "notion_create_page",
  "notion_update_page",
  "notion_write_page",
  "notion_create_database",
] as const;

const GMAIL_TOOLS = [
  "ask_user",
  "email_verify",
  "gmail_status",
  "gmail_list_messages",
  "gmail_get_message",
  "gmail_send",
  "gmail_template_upsert",
  "gmail_template_get",
  "gmail_template_list",
  "gmail_draft_upsert",
  "gmail_draft_from_template",
  "gmail_draft_get",
  "gmail_draft_list",
  "gmail_draft_discard",
  "gmail_draft_send_now",
  "gmail_schedule_send",
  "gmail_score_importance",
] as const;

async function readSkillMd(dir: string): Promise<string> {
  return Bun.file(new URL(`./${dir}/SKILL.md`, import.meta.url)).text();
}

/** Bundled seed packs. Written into SQLite only when the table is empty. */
export async function loadBundledSkillSeeds(): Promise<Omit<SkillRecord, "updatedAt">[]> {
  return [
    {
      id: "general-assistant",
      name: "General Assistant",
      description:
        "Default helpful assistant for general questions, scheduling, watchers, and light web research.",
      tags: ["general", "schedule", "watcher", "default"],
      instructions: await readSkillMd("general-assistant"),
      tools: [...CORE_TOOLS],
      maxSteps: 8,
      edges: [
        { to: "notion", kind: "routes-to" },
        { to: "gmail", kind: "routes-to" },
        { to: "websearch", kind: "compose-with" },
      ],
    },
    {
      id: "notion",
      name: "Notion",
      description:
        "Read, organize, and create Notion pages and databases. Search before write.",
      tags: ["notion", "notes", "wiki", "pages", "database"],
      instructions: await readSkillMd("notion"),
      tools: [...NOTION_TOOLS],
      maxSteps: 12,
      edges: [{ to: "general-assistant", kind: "compose-with" }],
    },
    {
      id: "gmail",
      name: "Gmail",
      description:
        "Draft, schedule, and send email through the connected Gmail account, including templates.",
      tags: ["gmail", "email", "mail", "draft", "send"],
      instructions: await readSkillMd("gmail"),
      tools: [...GMAIL_TOOLS],
      maxSteps: 12,
      edges: [{ to: "email-verify", kind: "compose-with" }],
    },
    {
      id: "email-verify",
      name: "Email Verify",
      description: "Check whether an email address is deliverable before trusting it.",
      tags: ["email", "verify", "smtp", "mx"],
      instructions: await readSkillMd("email-verify"),
      tools: ["ask_user", "email_verify"],
      maxSteps: 5,
      edges: [],
    },
    {
      id: "webfetch",
      name: "Web Fetch",
      description: "Fetch and read the contents of a URL when the user names a page to open.",
      tags: ["web", "fetch", "url", "http"],
      instructions: await readSkillMd("webfetch"),
      tools: ["ask_user", "webfetch"],
      maxSteps: 6,
      edges: [{ to: "websearch", kind: "compose-with" }],
    },
    {
      id: "websearch",
      name: "Web Search",
      description: "Search the live web for current facts, news, and product research.",
      tags: ["web", "search", "news", "research"],
      instructions: await readSkillMd("websearch"),
      tools: ["ask_user", "websearch"],
      maxSteps: 8,
      edges: [{ to: "webfetch", kind: "compose-with" }],
    },
  ];
}
