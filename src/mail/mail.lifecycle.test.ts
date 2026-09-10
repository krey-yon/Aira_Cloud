import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";

import {
  discardDraft,
  sendDraft,
  UnknownDraftError,
} from "./mail.lifecycle";
import { MailStore, resetMailStoreForTests } from "./mail.store";
import type { MailNode } from "./mail.types";

const testDb = `${process.cwd()}/data/mail.lifecycle.test.sqlite`;

function seedDraft(
  store: MailStore,
  patch?: Partial<{
    status: MailNode["status"];
    scheduleTaskId: string;
    gmailMessageId: string;
    subject: string;
    body: string;
    to: string[];
  }>,
): MailNode {
  return store.upsertDraft({
    accountEmail: "me@kreyon.in",
    to: patch?.to ?? ["alex@example.com"],
    subject: patch?.subject ?? "Hello",
    body: patch?.body ?? "Body with enough text to avoid the short penalty.",
    status: patch?.status,
    scheduleTaskId: patch?.scheduleTaskId,
    gmailMessageId: patch?.gmailMessageId,
  });
}

describe("mail lifecycle", () => {
  let store: MailStore;

  beforeEach(() => {
    try {
      unlinkSync(testDb);
    } catch {}
    resetMailStoreForTests();
    process.env.MAIL_DB = testDb;
    store = new MailStore(testDb);
  });

  afterEach(() => {
    resetMailStoreForTests();
    try {
      unlinkSync(testDb);
    } catch {}
  });

  test("sendDraft rejects a missing node", async () => {
    let caught: unknown;
    try {
      await sendDraft("mail_missing", { store, sendMessage: async () => {
        throw new Error("send must not run");
      } });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UnknownDraftError);
    expect((caught as Error).message).toBe("Unknown draft: mail_missing");
  });

  test("sendDraft returns early when already sent", async () => {
    const node = seedDraft(store, {
      status: "sent",
      gmailMessageId: "gmail_existing",
    });
    const result = await sendDraft(node.id, {
      store,
      sendMessage: async () => {
        throw new Error("send must not run for an already-sent draft");
      },
      cancelSchedule: async () => {
        throw new Error("cancel must not run for an already-sent draft");
      },
    });
    expect(result).toEqual({ alreadySent: true, draft: node });
    expect(store.getNode(node.id)?.status).toBe("sent");
    expect(store.getNode(node.id)?.gmailMessageId).toBe("gmail_existing");
  });

  test("sendDraft sends then marks the node sent", async () => {
    const node = seedDraft(store, {
      to: ["alex@example.com", "sam@example.com"],
      subject: "Ship notes",
      body: "Here are the launch notes for tonight.",
    });
    let sentPayload: unknown;
    const result = await sendDraft(node.id, {
      store,
      sendMessage: async (input) => {
        sentPayload = input;
        return { id: "gmail_abc", threadId: "th_1" };
      },
    });
    expect(result.alreadySent).toBe(false);
    if (result.alreadySent) throw new Error("expected a fresh send");
    expect(result.sent).toEqual({ id: "gmail_abc", threadId: "th_1" });
    expect(result.draft.status).toBe("sent");
    expect(result.draft.gmailMessageId).toBe("gmail_abc");
    expect(sentPayload).toEqual({
      to: ["alex@example.com", "sam@example.com"],
      cc: [],
      bcc: [],
      subject: "Ship notes",
      body: "Here are the launch notes for tonight.",
    });
    expect(store.getNode(node.id)?.status).toBe("sent");
    expect(store.getNode(node.id)?.gmailMessageId).toBe("gmail_abc");
  });

  test("sendDraft cancels a scheduled task before sending", async () => {
    const node = seedDraft(store, {
      status: "scheduled",
      scheduleTaskId: "task_send_1",
    });
    const cancelled: string[] = [];
    const result = await sendDraft(node.id, {
      store,
      sendMessage: async () => ({ id: "gmail_now", threadId: "th_now" }),
      cancelSchedule: async (taskId) => {
        cancelled.push(taskId);
      },
    });
    expect(cancelled).toEqual(["task_send_1"]);
    expect(result.alreadySent).toBe(false);
    expect(store.getNode(node.id)?.status).toBe("sent");
    expect(store.getNode(node.id)?.gmailMessageId).toBe("gmail_now");
  });

  test("sendDraft still sends when schedule cancel fails", async () => {
    const node = seedDraft(store, {
      status: "scheduled",
      scheduleTaskId: "task_running",
    });
    const result = await sendDraft(node.id, {
      store,
      sendMessage: async () => ({ id: "gmail_anyway", threadId: "th_anyway" }),
      cancelSchedule: async () => {
        throw new Error("Cannot cancel task in status running");
      },
    });
    expect(result.alreadySent).toBe(false);
    expect(store.getNode(node.id)?.gmailMessageId).toBe("gmail_anyway");
  });

  test("sendDraft leaves the node unsent when Gmail send fails", async () => {
    const node = seedDraft(store);
    let caught: unknown;
    try {
      await sendDraft(node.id, {
        store,
        sendMessage: async () => {
          throw new Error("Gmail send failed (500)");
        },
      });
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toBe("Gmail send failed (500)");
    expect(store.getNode(node.id)?.status).toBe("draft");
    expect(store.getNode(node.id)?.gmailMessageId).toBeUndefined();
  });

  test("sendDraft is idempotent across a second call", async () => {
    const node = seedDraft(store);
    const first = await sendDraft(node.id, {
      store,
      sendMessage: async () => ({ id: "gmail_once", threadId: "th_once" }),
    });
    const second = await sendDraft(node.id, {
      store,
      sendMessage: async () => {
        throw new Error("send must not run twice");
      },
    });
    expect(first.alreadySent).toBe(false);
    expect(second).toEqual({
      alreadySent: true,
      draft: store.getNode(node.id)!,
    });
    expect(store.getNode(node.id)?.gmailMessageId).toBe("gmail_once");
  });

  test("discardDraft rejects a missing node", async () => {
    let caught: unknown;
    try {
      await discardDraft("mail_missing", { store });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UnknownDraftError);
    expect((caught as Error).message).toBe("Unknown draft: mail_missing");
  });

  test("discardDraft marks a draft discarded", async () => {
    const node = seedDraft(store);
    const draft = await discardDraft(node.id, {
      store,
      cancelSchedule: async () => {
        throw new Error("cancel must not run for an unscheduled draft");
      },
    });
    expect(draft.status).toBe("discarded");
    expect(store.getNode(node.id)?.status).toBe("discarded");
  });

  test("discardDraft cancels a scheduled node", async () => {
    const node = seedDraft(store, {
      status: "scheduled",
      scheduleTaskId: "task_discard_1",
    });
    const cancelled: string[] = [];
    const draft = await discardDraft(node.id, {
      store,
      cancelSchedule: async (taskId) => {
        cancelled.push(taskId);
      },
    });
    expect(cancelled).toEqual(["task_discard_1"]);
    expect(draft.status).toBe("cancelled");
    expect(store.getNode(node.id)?.status).toBe("cancelled");
  });

  test("discardDraft still updates status when schedule cancel fails", async () => {
    const node = seedDraft(store, {
      status: "scheduled",
      scheduleTaskId: "task_gone",
    });
    const draft = await discardDraft(node.id, {
      store,
      cancelSchedule: async () => {
        throw new Error("Cannot cancel task in status running");
      },
    });
    expect(draft.status).toBe("cancelled");
  });
});
