import { getValidAccessToken } from "./gmail.oauth";
import { getGmailStore } from "./gmail.store";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  internalDate?: string;
};

export type GmailMessageDetail = GmailMessageSummary & {
  body: string;
  labelIds: string[];
};

export type GmailMessagePreview = GmailMessageSummary & {
  labelIds: string[];
  listUnsubscribe: string;
  precedence: string;
};

const PREVIEW_HEADERS = [
  "From",
  "To",
  "Subject",
  "Date",
  "List-Unsubscribe",
  "Precedence",
];

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  error?: { message?: string };
};

type GmailMessageResponse = {
  id?: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
    }>;
  };
  error?: { message?: string };
};

function header(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string,
): string {
  const hit = headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return hit?.value ?? "";
}

function decodeB64Url(data?: string): string {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function extractBody(payload: GmailMessageResponse["payload"]): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeB64Url(payload.body.data);
  const parts = payload.parts ?? [];
  const plain = parts.find((p) => p.mimeType === "text/plain");
  if (plain?.body?.data) return decodeB64Url(plain.body.data);
  for (const part of parts) {
    const nested = part.parts?.find((p) => p.mimeType === "text/plain");
    if (nested?.body?.data) return decodeB64Url(nested.body.data);
  }
  const html = parts.find((p) => p.mimeType === "text/html");
  if (html?.body?.data) {
    return decodeB64Url(html.body.data)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function summarize(msg: GmailMessageResponse): GmailMessageSummary {
  const headers = msg.payload?.headers;
  return {
    id: msg.id ?? "",
    threadId: msg.threadId ?? "",
    snippet: msg.snippet ?? "",
    from: header(headers, "From"),
    to: header(headers, "To"),
    subject: header(headers, "Subject"),
    date: header(headers, "Date"),
    internalDate: msg.internalDate,
  };
}

async function gmailFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Gmail is not connected");
  }
  return fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

export function buildRawMime(input: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}): string {
  const lines = [
    `To: ${input.to.join(", ")}`,
    ...(input.cc?.length ? [`Cc: ${input.cc.join(", ")}`] : []),
    ...(input.bcc?.length ? [`Bcc: ${input.bcc.join(", ")}`] : []),
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.body,
  ];
  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function listMessageIds(input?: {
  maxResults?: number;
  q?: string;
}): Promise<string[]> {
  const maxResults = Math.min(Math.max(input?.maxResults ?? 5, 1), 20);
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (input?.q) params.set("q", input.q);
  const listRes = await gmailFetch(`/messages?${params}`);
  const list = (await listRes.json()) as GmailListResponse;
  if (!listRes.ok) {
    throw new Error(list.error?.message || `Gmail list failed (${listRes.status})`);
  }
  return (list.messages ?? []).map((row) => row.id);
}

export async function listMessages(input?: {
  maxResults?: number;
  q?: string;
}): Promise<GmailMessageSummary[]> {
  const ids = await listMessageIds(input);
  const out: GmailMessageSummary[] = [];
  for (const id of ids) {
    out.push(await getMessage(id));
  }
  return out;
}

export async function listMessagePreviews(input?: {
  maxResults?: number;
  q?: string;
}): Promise<GmailMessagePreview[]> {
  const ids = await listMessageIds(input);
  const out: GmailMessagePreview[] = [];
  for (const id of ids) {
    out.push(await getMessagePreview(id));
  }
  return out;
}

async function getMessagePreview(id: string): Promise<GmailMessagePreview> {
  const params = new URLSearchParams({ format: "metadata" });
  for (const name of PREVIEW_HEADERS) params.append("metadataHeaders", name);
  const res = await gmailFetch(`/messages/${encodeURIComponent(id)}?${params}`);
  const msg = (await res.json()) as GmailMessageResponse;
  if (!res.ok) {
    throw new Error(msg.error?.message || `Gmail get failed (${res.status})`);
  }
  const headers = msg.payload?.headers;
  return {
    ...summarize(msg),
    labelIds: msg.labelIds ?? [],
    listUnsubscribe: header(headers, "List-Unsubscribe"),
    precedence: header(headers, "Precedence"),
  };
}

export async function getMessage(id: string): Promise<GmailMessageDetail> {
  const res = await gmailFetch(`/messages/${encodeURIComponent(id)}?format=full`);
  const msg = (await res.json()) as GmailMessageResponse;
  if (!res.ok) {
    throw new Error(msg.error?.message || `Gmail get failed (${res.status})`);
  }
  const summary = summarize(msg);
  return {
    ...summary,
    body: extractBody(msg.payload) || summary.snippet,
    labelIds: msg.labelIds ?? [],
  };
}

export async function sendMessage(input: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}): Promise<{ id: string; threadId: string }> {
  if (!input.to.length) throw new Error("to is required");
  if (!input.subject.trim()) throw new Error("subject is required");
  const raw = buildRawMime(input);
  const res = await gmailFetch("/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const data = (await res.json()) as { id?: string; threadId?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `Gmail send failed (${res.status})`);
  }
  return { id: data.id, threadId: data.threadId ?? "" };
}

export function connectedAccountEmail(): string | null {
  return getGmailStore().primary()?.email ?? null;
}
