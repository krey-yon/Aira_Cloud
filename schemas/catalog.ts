export type CatalogKind = "request" | "response" | "entity" | "event" | "config" | "error";

export type CatalogEntry = {
  id: string;
  kind: CatalogKind;
  domain: string;
  title: string;
  schemaName: string;
};

export const catalog: CatalogEntry[] = [
  { id: "ErrorBody", kind: "error", domain: "shared", title: "HTTP and WS error payload", schemaName: "ErrorBody" },
  { id: "ServerLog", kind: "entity", domain: "shared", title: "In-memory log ring record", schemaName: "ServerLog" },
  { id: "CollectErrorInput", kind: "request", domain: "shared", title: "POST /v1/collect-error body", schemaName: "CollectErrorInput" },
  { id: "CollectedError", kind: "entity", domain: "shared", title: "Redis collected error record", schemaName: "CollectedError" },
  { id: "HealthResponse", kind: "response", domain: "http", title: "GET /health body", schemaName: "HealthResponse" },
  { id: "ListQuery", kind: "request", domain: "http", title: "Shared list search params", schemaName: "ListQuery" },
  { id: "PageContext", kind: "entity", domain: "agent", title: "Page url and title on ask and jobs", schemaName: "PageContext" },
  { id: "JobToolCall", kind: "entity", domain: "agent", title: "Tool name, args string, unknown result", schemaName: "JobToolCall" },
  { id: "Job", kind: "entity", domain: "agent", title: "In-memory job record", schemaName: "Job" },
  { id: "JobEvent", kind: "event", domain: "agent", title: "Job timeline event", schemaName: "JobEvent" },
  { id: "AskRequest", kind: "request", domain: "agent", title: "POST /v1/ask body", schemaName: "AskRequest" },
  { id: "AskResponse", kind: "response", domain: "agent", title: "Accepted ask jobId and status", schemaName: "AskResponse" },
  { id: "JobHttpResponse", kind: "response", domain: "agent", title: "GET job body including JobStore.toHttp extras", schemaName: "JobHttpResponse" },
  { id: "QuestionOption", kind: "entity", domain: "agent", title: "Ask-user and widget option chip", schemaName: "QuestionOption" },
  { id: "WidgetAction", kind: "entity", domain: "agent", title: "Widget button action", schemaName: "WidgetAction" },
  { id: "Widget", kind: "entity", domain: "agent", title: "Floating widget payload", schemaName: "Widget" },
  { id: "QuestionReply", kind: "request", domain: "agent", title: "Human answer to ask-user", schemaName: "QuestionReply" },
  { id: "AgentRunResult", kind: "response", domain: "agent", title: "AgentService run output", schemaName: "AgentRunResult" },
  { id: "ClientMessage", kind: "event", domain: "realtime", title: "Extension to cloud WS message", schemaName: "ClientMessage" },
  { id: "ServerMessage", kind: "event", domain: "realtime", title: "Cloud to extension WS message", schemaName: "ServerMessage" },
  { id: "RequestContext", kind: "entity", domain: "realtime", title: "ALS clientId and jobId for tools", schemaName: "RequestContext" },
  { id: "ImportanceScore", kind: "entity", domain: "mail", title: "Outbound draft importance score", schemaName: "ImportanceScore" },
  { id: "MailTemplate", kind: "entity", domain: "mail", title: "Stored mail template", schemaName: "MailTemplate" },
  { id: "MailNode", kind: "entity", domain: "mail", title: "Draft, scheduled, or sent mail node", schemaName: "MailNode" },
  { id: "RecentMailCard", kind: "entity", domain: "mail", title: "Inbox card on the mail board", schemaName: "RecentMailCard" },
  { id: "MailBoard", kind: "response", domain: "mail", title: "GET /v1/mail/board payload", schemaName: "MailBoard" },
  { id: "SendDraftResult", kind: "response", domain: "mail", title: "Send already-sent vs newly sent", schemaName: "SendDraftResult" },
  { id: "GmailStatus", kind: "response", domain: "gmail", title: "Public Gmail connection status", schemaName: "GmailStatus" },
  { id: "GmailMessage", kind: "entity", domain: "gmail", title: "Gmail list message fields", schemaName: "GmailMessage" },
  { id: "GmailMessageDetail", kind: "entity", domain: "gmail", title: "Gmail message body and labels", schemaName: "GmailMessageDetail" },
  { id: "WatchCondition", kind: "entity", domain: "watcher", title: "JSON path, op, and optional value", schemaName: "WatchCondition" },
  { id: "WatcherWrite", kind: "request", domain: "watcher", title: "Create or PATCH watcher input", schemaName: "WatcherWrite" },
  { id: "Watcher", kind: "entity", domain: "watcher", title: "Watcher entity with nested conditions", schemaName: "Watcher" },
  { id: "NotifyEvent", kind: "event", domain: "watcher", title: "Notification queue event", schemaName: "NotifyEvent" },
  { id: "ScheduleMetadata", kind: "entity", domain: "schedule", title: "Task metadata with mailAction catch-all", schemaName: "ScheduleMetadata" },
  { id: "ScheduleWrite", kind: "request", domain: "schedule", title: "Create scheduled task body", schemaName: "ScheduleWrite" },
  { id: "ScheduledTask", kind: "entity", domain: "schedule", title: "Scheduled task entity", schemaName: "ScheduledTask" },
  { id: "SkillEdge", kind: "entity", domain: "skill", title: "Skill graph edge", schemaName: "SkillEdge" },
  { id: "SkillWrite", kind: "request", domain: "skill", title: "POST or PUT skill body", schemaName: "SkillWrite" },
  { id: "Skill", kind: "entity", domain: "skill", title: "Full skill record", schemaName: "Skill" },
  { id: "SkillMeta", kind: "entity", domain: "skill", title: "Skill list row without instructions", schemaName: "SkillMeta" },
  { id: "CanvasWrite", kind: "request", domain: "canvas", title: "Canvas upsert input", schemaName: "CanvasWrite" },
  { id: "Canvas", kind: "entity", domain: "canvas", title: "Stored canvas page", schemaName: "Canvas" },
  { id: "CanvasListItem", kind: "response", domain: "canvas", title: "Canvas list card with url and expiresAt", schemaName: "CanvasListItem" },
  { id: "ToolResult", kind: "response", domain: "integrations", title: "Tool output envelope with ok", schemaName: "ToolResult" },
  { id: "NotionRef", kind: "entity", domain: "integrations", title: "Notion id with optional url and title", schemaName: "NotionRef" },
];
