import { Database } from "bun:sqlite";
import { config } from "../config";
import { createSingleton, openSqlite } from "../persist/sqlite";
import {
  fillTemplate,
  newMailId,
  scoreOutboundImportance,
  type MailNode,
  type MailNodeStatus,
  type MailTemplate,
} from "./mail.types";

type TemplateRow = {
  id: string;
  name: string;
  subject_template: string;
  body_markdown: string;
  variables_json: string;
  created_at: string;
  updated_at: string;
};

type NodeRow = {
  id: string;
  account_email: string;
  to_json: string;
  cc_json: string;
  bcc_json: string;
  subject: string;
  body: string;
  status: string;
  template_id: string | null;
  importance_json: string | null;
  schedule_task_id: string | null;
  run_at: string | null;
  gmail_message_id: string | null;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapTemplate(row: TemplateRow): MailTemplate {
  return {
    id: row.id,
    name: row.name,
    subjectTemplate: row.subject_template,
    bodyMarkdown: row.body_markdown,
    variables: parseJson<string[]>(row.variables_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNode(row: NodeRow): MailNode {
  return {
    id: row.id,
    accountEmail: row.account_email,
    to: parseJson<string[]>(row.to_json, []),
    cc: parseJson<string[]>(row.cc_json, []),
    bcc: parseJson<string[]>(row.bcc_json, []),
    subject: row.subject,
    body: row.body,
    status: row.status as MailNodeStatus,
    templateId: row.template_id ?? undefined,
    importance: parseJson(row.importance_json, undefined),
    scheduleTaskId: row.schedule_task_id ?? undefined,
    runAt: row.run_at ?? undefined,
    gmailMessageId: row.gmail_message_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MailStore {
  private readonly db: Database;

  constructor(dbPath = config.mailDbPath) {
    this.db = openSqlite(dbPath, { wal: false });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mail_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject_template TEXT NOT NULL,
        body_markdown TEXT NOT NULL,
        variables_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mail_nodes (
        id TEXT PRIMARY KEY,
        account_email TEXT NOT NULL,
        to_json TEXT NOT NULL,
        cc_json TEXT NOT NULL DEFAULT '[]',
        bcc_json TEXT NOT NULL DEFAULT '[]',
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL,
        template_id TEXT,
        importance_json TEXT,
        schedule_task_id TEXT,
        run_at TEXT,
        gmail_message_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mail_nodes_status ON mail_nodes(status);
    `);
  }

  upsertTemplate(input: {
    id?: string;
    name: string;
    subjectTemplate: string;
    bodyMarkdown: string;
    variables?: string[];
  }): MailTemplate {
    const now = new Date().toISOString();
    const id = input.id?.trim() || newMailId("tpl");
    const existing = this.getTemplate(id);
    const createdAt = existing?.createdAt ?? now;
    this.db
      .query(
        `INSERT INTO mail_templates
          (id, name, subject_template, body_markdown, variables_json, created_at, updated_at)
         VALUES ($id, $name, $subject, $body, $vars, $created, $updated)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           subject_template = excluded.subject_template,
           body_markdown = excluded.body_markdown,
           variables_json = excluded.variables_json,
           updated_at = excluded.updated_at`,
      )
      .run({
        $id: id,
        $name: input.name,
        $subject: input.subjectTemplate,
        $body: input.bodyMarkdown,
        $vars: JSON.stringify(input.variables ?? []),
        $created: createdAt,
        $updated: now,
      });
    return this.getTemplate(id)!;
  }

  getTemplate(id: string): MailTemplate | null {
    const row = this.db
      .query(`SELECT * FROM mail_templates WHERE id = ?`)
      .get(id) as TemplateRow | null;
    return row ? mapTemplate(row) : null;
  }

  listTemplates(): MailTemplate[] {
    const rows = this.db
      .query(`SELECT * FROM mail_templates ORDER BY updated_at DESC`)
      .all() as TemplateRow[];
    return rows.map(mapTemplate);
  }

  upsertDraft(input: {
    id?: string;
    accountEmail: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    templateId?: string;
    status?: MailNodeStatus;
    scheduleTaskId?: string;
    runAt?: string;
    gmailMessageId?: string;
    rescore?: boolean;
  }): MailNode {
    const now = new Date().toISOString();
    const id = input.id?.trim() || newMailId("mail");
    const existing = this.getNode(id);
    const status = input.status ?? existing?.status ?? "draft";
    const importance =
      input.rescore === false && existing?.importance
        ? existing.importance
        : scoreOutboundImportance({
            subject: input.subject,
            body: input.body,
            to: input.to,
            templateId: input.templateId ?? existing?.templateId,
          });
    this.db
      .query(
        `INSERT INTO mail_nodes
          (id, account_email, to_json, cc_json, bcc_json, subject, body, status,
           template_id, importance_json, schedule_task_id, run_at, gmail_message_id,
           created_at, updated_at)
         VALUES
          ($id, $account, $to, $cc, $bcc, $subject, $body, $status,
           $template, $importance, $task, $runAt, $gmailId, $created, $updated)
         ON CONFLICT(id) DO UPDATE SET
           account_email = excluded.account_email,
           to_json = excluded.to_json,
           cc_json = excluded.cc_json,
           bcc_json = excluded.bcc_json,
           subject = excluded.subject,
           body = excluded.body,
           status = excluded.status,
           template_id = excluded.template_id,
           importance_json = excluded.importance_json,
           schedule_task_id = excluded.schedule_task_id,
           run_at = excluded.run_at,
           gmail_message_id = excluded.gmail_message_id,
           updated_at = excluded.updated_at`,
      )
      .run({
        $id: id,
        $account: input.accountEmail,
        $to: JSON.stringify(input.to),
        $cc: JSON.stringify(input.cc ?? existing?.cc ?? []),
        $bcc: JSON.stringify(input.bcc ?? existing?.bcc ?? []),
        $subject: input.subject,
        $body: input.body,
        $status: status,
        $template: input.templateId ?? existing?.templateId ?? null,
        $importance: JSON.stringify(importance),
        $task: input.scheduleTaskId ?? existing?.scheduleTaskId ?? null,
        $runAt: input.runAt ?? existing?.runAt ?? null,
        $gmailId: input.gmailMessageId ?? existing?.gmailMessageId ?? null,
        $created: existing?.createdAt ?? now,
        $updated: now,
      });
    return this.getNode(id)!;
  }

  draftFromTemplate(input: {
    templateId: string;
    accountEmail: string;
    to: string[];
    vars?: Record<string, string>;
    cc?: string[];
    bcc?: string[];
  }): MailNode {
    const template = this.getTemplate(input.templateId);
    if (!template) throw new Error(`Unknown template: ${input.templateId}`);
    const vars = input.vars ?? {};
    return this.upsertDraft({
      accountEmail: input.accountEmail,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: fillTemplate(template.subjectTemplate, vars),
      body: fillTemplate(template.bodyMarkdown, vars),
      templateId: template.id,
      status: "draft",
    });
  }

  getNode(id: string): MailNode | null {
    const row = this.db
      .query(`SELECT * FROM mail_nodes WHERE id = ?`)
      .get(id) as NodeRow | null;
    return row ? mapNode(row) : null;
  }

  listNodes(status?: MailNodeStatus | MailNodeStatus[]): MailNode[] {
    if (!status) {
      const rows = this.db
        .query(
          `SELECT * FROM mail_nodes
           WHERE status NOT IN ('discarded')
           ORDER BY updated_at DESC`,
        )
        .all() as NodeRow[];
      return rows.map(mapNode);
    }
    const statuses = Array.isArray(status) ? status : [status];
    const placeholders = statuses.map(() => "?").join(",");
    const rows = this.db
      .query(
        `SELECT * FROM mail_nodes
         WHERE status IN (${placeholders})
         ORDER BY updated_at DESC`,
      )
      .all(...statuses) as NodeRow[];
    return rows.map(mapNode);
  }

  setStatus(
    id: string,
    status: MailNodeStatus,
    patch?: Partial<Pick<MailNode, "scheduleTaskId" | "runAt" | "gmailMessageId">>,
  ): MailNode {
    const node = this.getNode(id);
    if (!node) throw new Error(`Unknown mail node: ${id}`);
    return this.upsertDraft({
      id: node.id,
      accountEmail: node.accountEmail,
      to: node.to,
      cc: node.cc,
      bcc: node.bcc,
      subject: node.subject,
      body: node.body,
      templateId: node.templateId,
      status,
      scheduleTaskId: patch?.scheduleTaskId ?? node.scheduleTaskId,
      runAt: patch?.runAt ?? node.runAt,
      gmailMessageId: patch?.gmailMessageId ?? node.gmailMessageId,
      rescore: false,
    });
  }

  rescore(id: string): MailNode {
    const node = this.getNode(id);
    if (!node) throw new Error(`Unknown mail node: ${id}`);
    return this.upsertDraft({
      id: node.id,
      accountEmail: node.accountEmail,
      to: node.to,
      cc: node.cc,
      bcc: node.bcc,
      subject: node.subject,
      body: node.body,
      templateId: node.templateId,
      status: node.status,
      scheduleTaskId: node.scheduleTaskId,
      runAt: node.runAt,
      gmailMessageId: node.gmailMessageId,
      rescore: true,
    });
  }
}

const mailStore = createSingleton(() => new MailStore());

export function getMailStore(): MailStore {
  return mailStore.get();
}

export function resetMailStoreForTests(): void {
  mailStore.reset();
}
