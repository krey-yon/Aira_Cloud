import { getScheduler } from "../scheduler";
import { sendMessage } from "../gmail/gmail.client";
import { getMailStore, type MailStore } from "./mail.store";
import type { MailNode } from "./mail.types";

export class UnknownDraftError extends Error {
  readonly draftId: string;

  constructor(id: string) {
    super(`Unknown draft: ${id}`);
    this.name = "UnknownDraftError";
    this.draftId = id;
  }
}

export type MailLifecycleDeps = {
  store?: MailStore;
  sendMessage?: typeof sendMessage;
  cancelSchedule?: (taskId: string) => Promise<unknown>;
};

export type SendDraftResult =
  | { alreadySent: true; draft: MailNode }
  | { alreadySent: false; draft: MailNode; sent: { id: string; threadId: string } };

async function cancelIfScheduled(
  node: MailNode,
  cancel: (taskId: string) => Promise<unknown>,
): Promise<void> {
  if (!node.scheduleTaskId || node.status !== "scheduled") return;
  try {
    await cancel(node.scheduleTaskId);
  } catch {
    // Scheduler.cancel throws when the task is no longer pending.
  }
}

export async function sendDraft(
  id: string,
  deps: MailLifecycleDeps = {},
): Promise<SendDraftResult> {
  const store = deps.store ?? getMailStore();
  const send = deps.sendMessage ?? sendMessage;
  const cancel =
    deps.cancelSchedule ?? ((taskId: string) => getScheduler().cancel(taskId));
  const node = store.getNode(id);
  if (!node) throw new UnknownDraftError(id);
  if (node.status === "sent") {
    return { alreadySent: true, draft: node };
  }
  await cancelIfScheduled(node, cancel);
  const sent = await send({
    to: node.to,
    cc: node.cc,
    bcc: node.bcc,
    subject: node.subject,
    body: node.body,
  });
  const draft = store.setStatus(id, "sent", { gmailMessageId: sent.id });
  return { alreadySent: false, draft, sent };
}

export async function discardDraft(
  id: string,
  deps: MailLifecycleDeps = {},
): Promise<MailNode> {
  const store = deps.store ?? getMailStore();
  const cancel =
    deps.cancelSchedule ?? ((taskId: string) => getScheduler().cancel(taskId));
  const node = store.getNode(id);
  if (!node) throw new UnknownDraftError(id);
  await cancelIfScheduled(node, cancel);
  return store.setStatus(
    id,
    node.status === "scheduled" ? "cancelled" : "discarded",
  );
}
