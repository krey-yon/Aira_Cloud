import { tool } from "ai";
import { z } from "zod";

import {
  connectedAccountEmail,
  getMessage,
  listMessages,
  sendMessage,
} from "../gmail/gmail.client";
import { gmailStatus } from "../gmail/gmail.oauth";
import { discardDraft, sendDraft } from "../mail/mail.lifecycle";
import { getMailStore } from "../mail/mail.store";
import { getScheduler } from "../scheduler";
import { getRequestContext } from "../realtime/request-context";

function fail(error: unknown) {
  return {
    ok: false as const,
    error: error instanceof Error ? error.message : String(error),
  };
}

function requireAccount(): string {
  const email = connectedAccountEmail();
  if (!email) throw new Error("Gmail is not connected");
  return email;
}

export const gmailStatusTool = tool({
  description: "Check whether Gmail is connected for send and read.",
  inputSchema: z.object({}),
  execute: async () => {
    const status = gmailStatus();
    return { ok: true as const, ...status };
  },
});

export const gmailListMessagesTool = tool({
  description: "List recent Gmail messages (newest first).",
  inputSchema: z.object({
    maxResults: z.number().int().min(1).max(20).default(5),
    q: z.string().optional().describe("Optional Gmail search query"),
  }),
  execute: async (input) => {
    try {
      const messages = await listMessages({
        maxResults: input.maxResults,
        q: input.q,
      });
      return { ok: true as const, count: messages.length, messages };
    } catch (err) {
      return fail(err);
    }
  },
});

export const gmailGetMessageTool = tool({
  description: "Read one Gmail message by id.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Gmail message id"),
  }),
  execute: async ({ id }) => {
    try {
      const message = await getMessage(id);
      return { ok: true as const, message };
    } catch (err) {
      return fail(err);
    }
  },
});

export const gmailSendTool = tool({
  description: "Send an email through the connected Gmail account.",
  inputSchema: z.object({
    to: z.array(z.string().email()).min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
  }),
  execute: async (input) => {
    try {
      requireAccount();
      const sent = await sendMessage(input);
      return { ok: true as const, id: sent.id, threadId: sent.threadId };
    } catch (err) {
      return fail(err);
    }
  },
});

export const gmailTemplateUpsertTool = tool({
  description: "Create or update an email template by id.",
  inputSchema: z.object({
    id: z.string().optional().describe("Stable template id, e.g. tpl_outreach_v2"),
    name: z.string().min(1),
    subjectTemplate: z.string().min(1),
    bodyMarkdown: z.string().min(1),
    variables: z.array(z.string()).optional(),
  }),
  execute: async (input) => {
    try {
      const template = getMailStore().upsertTemplate(input);
      return { ok: true as const, template };
    } catch (err) {
      return fail(err);
    }
  },
});

export const gmailTemplateGetTool = tool({
  description: "Get an email template by id.",
  inputSchema: z.object({ id: z.string().min(1) }),
  execute: async ({ id }) => {
    const template = getMailStore().getTemplate(id);
    if (!template) return fail(new Error(`Unknown template: ${id}`));
    return { ok: true as const, template };
  },
});

export const gmailTemplateListTool = tool({
  description: "List email templates.",
  inputSchema: z.object({}),
  execute: async () => {
    const templates = getMailStore().listTemplates();
    return { ok: true as const, count: templates.length, templates };
  },
});

export const gmailDraftUpsertTool = tool({
  description: "Create or update an Aira-local email draft shown on the mail board.",
  inputSchema: z.object({
    id: z.string().optional(),
    to: z.array(z.string().email()).min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    templateId: z.string().optional(),
  }),
  execute: async (input) => {
    try {
      const accountEmail = requireAccount();
      const draft = getMailStore().upsertDraft({
        ...input,
        accountEmail,
        status: "draft",
      });
      return { ok: true as const, draft };
    } catch (err) {
      return fail(err);
    }
  },
});

export const gmailDraftFromTemplateTool = tool({
  description:
    "Draft an email from a template id for a recipient. Use when the user says mail them this template.",
  inputSchema: z.object({
    templateId: z.string().min(1),
    to: z.array(z.string().email()).min(1),
    vars: z.record(z.string(), z.string()).optional(),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
  }),
  execute: async (input) => {
    try {
      const accountEmail = requireAccount();
      const draft = getMailStore().draftFromTemplate({
        templateId: input.templateId,
        accountEmail,
        to: input.to,
        vars: input.vars,
        cc: input.cc,
        bcc: input.bcc,
      });
      return { ok: true as const, draft };
    } catch (err) {
      return fail(err);
    }
  },
});

export const gmailDraftGetTool = tool({
  description: "Get one Aira mail draft or scheduled node by id.",
  inputSchema: z.object({ id: z.string().min(1) }),
  execute: async ({ id }) => {
    const draft = getMailStore().getNode(id);
    if (!draft) return fail(new Error(`Unknown draft: ${id}`));
    return { ok: true as const, draft };
  },
});

export const gmailDraftListTool = tool({
  description: "List Aira drafts and scheduled mail nodes.",
  inputSchema: z.object({
    status: z.enum(["draft", "scheduled", "sent", "cancelled"]).optional(),
  }),
  execute: async ({ status }) => {
    const drafts = getMailStore().listNodes(status);
    return { ok: true as const, count: drafts.length, drafts };
  },
});

export const gmailDraftDiscardTool = tool({
  description: "Discard an Aira draft or cancel a scheduled mail node.",
  inputSchema: z.object({ id: z.string().min(1) }),
  execute: async ({ id }) => {
    try {
      const draft = await discardDraft(id);
      return { ok: true as const, draft };
    } catch (err) {
      return fail(err);
    }
  },
});

export const gmailDraftSendNowTool = tool({
  description: "Send an Aira draft (or scheduled draft) immediately through Gmail.",
  inputSchema: z.object({ id: z.string().min(1) }),
  execute: async ({ id }) => {
    try {
      const result = await sendDraft(id);
      if (result.alreadySent) {
        return {
          ok: true as const,
          alreadySent: true,
          id: result.draft.gmailMessageId,
          draft: result.draft,
        };
      }
      return {
        ok: true as const,
        id: result.sent.id,
        threadId: result.sent.threadId,
        draft: result.draft,
      };
    } catch (err) {
      return fail(err);
    }
  },
});

export const gmailScheduleSendTool = tool({
  description: "Schedule an Aira draft to send later. Fires once via the scheduler.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Mail draft id"),
    title: z.string().optional(),
    runAt: z.string().optional(),
    delayMinutes: z.number().positive().optional(),
    delayHours: z.number().positive().optional(),
    delayDays: z.number().positive().optional(),
  }),
  execute: async (input) => {
    try {
      const store = getMailStore();
      const node = store.getNode(input.id);
      if (!node) throw new Error(`Unknown draft: ${input.id}`);
      if (node.status === "sent") throw new Error("Draft already sent");
      const task = await getScheduler().schedule({
        title: input.title ?? `Send: ${node.subject}`,
        prompt: `Send Aira mail draft ${node.id} now using gmail_draft_send_now.`,
        runAt: input.runAt,
        delayMinutes: input.delayMinutes,
        delayHours: input.delayHours,
        delayDays: input.delayDays,
        skillId: "gmail",
        clientId: getRequestContext().clientId,
        metadata: {
          mailAction: "send_draft",
          draftId: node.id,
        },
      });
      const draft = store.setStatus(node.id, "scheduled", {
        scheduleTaskId: task.id,
        runAt: task.runAt,
      });
      return {
        ok: true as const,
        task: { id: task.id, runAt: task.runAt, status: task.status },
        draft,
      };
    } catch (err) {
      return fail(err);
    }
  },
});

export const gmailScoreImportanceTool = tool({
  description: "Score outbound draft importance from 0 to 100.",
  inputSchema: z.object({ id: z.string().min(1) }),
  execute: async ({ id }) => {
    try {
      const draft = getMailStore().rescore(id);
      return { ok: true as const, importance: draft.importance, draft };
    } catch (err) {
      return fail(err);
    }
  },
});
