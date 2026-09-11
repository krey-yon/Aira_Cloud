import { AgentRunResult, AskRequest, AskResponse, Job, JobEvent, JobHttpResponse, JobToolCall, PageContext, QuestionOption, QuestionReply, Widget, WidgetAction } from "./agent";
import { Canvas, CanvasListItem, CanvasWrite } from "./canvas";
import { GmailAccount, GmailMessage, GmailMessageDetail, GmailStatus } from "./gmail";
import { HealthResponse, ListQuery } from "./http";
import { NotionRef, ToolResult } from "./integrations";
import { ImportanceScore, MailBoard, MailNode, MailTemplate, RecentMailCard, SendDraftResult } from "./mail";
import { ClientMessage, RequestContext, ServerMessage } from "./realtime";
import { ScheduleMetadata, ScheduleWrite, ScheduledTask } from "./schedule";
import { CloudConfig, CollectErrorInput, CollectedError, ErrorBody, ServerLog } from "./shared";
import { Skill, SkillEdge, SkillMeta, SkillWrite } from "./skill";
import { NotifyEvent, WatchCondition, Watcher, WatcherWrite } from "./watcher";

export * from "./agent";
export * from "./canvas";
export * from "./catalog";
export * from "./gmail";
export * from "./http";
export * from "./integrations";
export * from "./mail";
export * from "./primitives";
export * from "./realtime";
export * from "./schedule";
export * from "./shared";
export * from "./skill";
export * from "./watcher";

export const schemas = {
  ErrorBody,
  ServerLog,
  CollectedError,
  CollectErrorInput,
  HealthResponse,
  ListQuery,
  PageContext,
  JobToolCall,
  Job,
  JobEvent,
  AskRequest,
  AskResponse,
  JobHttpResponse,
  QuestionOption,
  WidgetAction,
  Widget,
  QuestionReply,
  AgentRunResult,
  ClientMessage,
  ServerMessage,
  RequestContext,
  ImportanceScore,
  MailTemplate,
  MailNode,
  RecentMailCard,
  MailBoard,
  SendDraftResult,
  GmailStatus,
  GmailMessage,
  GmailMessageDetail,
  WatchCondition,
  Watcher,
  WatcherWrite,
  NotifyEvent,
  ScheduledTask,
  ScheduleWrite,
  ScheduleMetadata,
  SkillEdge,
  Skill,
  SkillMeta,
  SkillWrite,
  Canvas,
  CanvasWrite,
  CanvasListItem,
  ToolResult,
  NotionRef,
} as const;

export const secretSchemas = {
  CloudConfig,
  GmailAccount,
} as const;

export type SchemaName = keyof typeof schemas;
