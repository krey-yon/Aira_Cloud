import type { RecentMailCard } from "./mail.preview";

export type { RecentMailCard };

export type MailNodeStatus = "draft" | "scheduled" | "sent" | "cancelled" | "discarded";

export type ImportanceScore = {
  score: number;
  label: "low" | "medium" | "high" | "critical";
  reasons: string[];
  scoredAt: string;
};

export type MailTemplate = {
  id: string;
  name: string;
  subjectTemplate: string;
  bodyMarkdown: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
};

export type MailNode = {
  id: string;
  accountEmail: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  status: MailNodeStatus;
  templateId?: string;
  importance?: ImportanceScore;
  scheduleTaskId?: string;
  runAt?: string;
  gmailMessageId?: string;
  createdAt: string;
  updatedAt: string;
};

export type MailBoardPayload = {
  drafts: MailNode[];
  scheduled: MailNode[];
  recent: RecentMailCard[];
};

export function newMailId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}

export function scoreOutboundImportance(input: {
  subject: string;
  body: string;
  to: string[];
  templateId?: string;
}): ImportanceScore {
  let score = 40;
  const reasons: string[] = [];
  const text = `${input.subject}\n${input.body}`.toLowerCase();
  if (/\b(urgent|asap|immediately|critical)\b/.test(text)) {
    score += 25;
    reasons.push("urgency language");
  }
  if (/\b(invoice|payment|contract|offer)\b/.test(text)) {
    score += 15;
    reasons.push("money or contract terms");
  }
  if (/\b(follow[- ]?up|thanks|thank you)\b/.test(text)) {
    score += 8;
    reasons.push("follow-up tone");
  }
  if (input.to.length > 1) {
    score += 5;
    reasons.push("multiple recipients");
  }
  if (input.templateId) {
    score += 5;
    reasons.push("uses a template");
  }
  if (input.body.trim().length < 40) {
    score -= 10;
    reasons.push("very short body");
  }
  score = Math.max(0, Math.min(100, score));
  const label =
    score >= 85 ? "critical" : score >= 70 ? "high" : score >= 45 ? "medium" : "low";
  if (!reasons.length) reasons.push("default outbound weight");
  return { score, label, reasons, scoredAt: new Date().toISOString() };
}
