import consoleIndex from "../../console/index.html";

import type { AskHttpRequest } from "../shared/agent";
import { newClientId } from "../shared/agent";
import { config } from "../config";
import { authorize, extractBearer, json, readJson, requireAuth } from "./auth";
import type { CollectErrorInput } from "../observability/error.store";
import type { ScheduleInput } from "../scheduler";
import {
  completeGmailOAuth,
  consumeOAuthState,
  createGmailAuthUrl,
  gmailConfigured,
  gmailStatus,
} from "../gmail/gmail.oauth";
import { getGmailStore } from "../gmail/gmail.store";
import { getMessage, listMessagePreviews } from "../gmail/gmail.client";
import { discardDraft, sendDraft, UnknownDraftError } from "../mail/mail.lifecycle";
import { getMailStore } from "../mail/mail.store";
import {
  pickRecentCards,
  RECENT_FETCH_WINDOW,
  RECENT_INBOX_QUERY,
  type RecentMailCard,
} from "../mail/mail.preview";
import { getSkills } from "../skills";
import type { WatcherInput, WatcherStatus } from "../watchers/watcher.store";
import { canvasPage } from "../canvas/canvas-page";
import type { AppDeps } from "./deps";
import { startJob } from "./ws";

export function createRoutes(deps: AppDeps) {
  const { canvases, logs, jobs, errors, scheduler, watchers, notifyQueue, clients } = deps;

  return {
    "/": consoleIndex,
    "/icons/icon16.png": Bun.file("./console/icons/icon16.png"),
    "/icons/icon48.png": Bun.file("./console/icons/icon48.png"),
    "/icons/icon128.png": Bun.file("./console/icons/icon128.png"),
    "/r/:id": {
      GET: (req: { params: { id: string } }) => {
        const id = req.params.id;
        const record = canvases.get(id);
        if (!record) {
          return new Response("Canvas not found", { status: 404 });
        }
        return new Response(canvasPage(record), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
    "/health": {
      GET: () =>
        json({
          ok: true,
          service: "aira-on-cloud",
          authRequired: Boolean(config.cloudToken),
          scheduler: true,
          console: true,
          gmail: gmailConfigured(),
          workersAi: {
            accountConfigured: Boolean(config.cloudflareAccountId),
            tokenConfigured: Boolean(config.cloudflareApiToken),
            model: config.defaultModel,
          },
        }),
    },
    "/auth/gmail": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        if (!gmailConfigured()) {
          return json(
            {
              error:
                "Gmail OAuth is not configured. Set CLIENT_ID, CLIENT_SECRET, and REDIRECT_URI.",
            },
            503,
          );
        }
        try {
          const { url } = createGmailAuthUrl();
          return Response.redirect(url, 302);
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            500,
          );
        }
      },
    },
    "/auth/gmail/callback": {
      GET: async (req: Request) => {
        const url = new URL(req.url);
        const error = url.searchParams.get("error");
        if (error) {
          return Response.redirect(
            `/?gmail=error&message=${encodeURIComponent(error)}`,
            302,
          );
        }
        const state = url.searchParams.get("state");
        if (!consumeOAuthState(state)) {
          return Response.redirect("/?gmail=error&message=invalid_state", 302);
        }
        const code = url.searchParams.get("code");
        if (!code) {
          return Response.redirect("/?gmail=error&message=missing_code", 302);
        }
        try {
          const account = await completeGmailOAuth(code);
          logs.append({
            kind: "server",
            level: "info",
            title: "gmail:connected",
            body: account.email,
            source: "gmail",
          });
          return Response.redirect(
            `/?gmail=connected&email=${encodeURIComponent(account.email)}`,
            302,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logs.append({
            kind: "error",
            level: "error",
            title: "gmail:oauth",
            body: message.slice(0, 800),
            source: "gmail",
          });
          return Response.redirect(
            `/?gmail=error&message=${encodeURIComponent(message)}`,
            302,
          );
        }
      },
    },
    "/v1/gmail": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        return json(gmailStatus());
      },
      DELETE: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const account = getGmailStore().primary();
        if (!account) return json({ ok: true, connected: false });
        getGmailStore().delete(account.email);
        logs.append({
          kind: "server",
          level: "info",
          title: "gmail:disconnected",
          body: account.email,
          source: "gmail",
        });
        return json({ ok: true, connected: false });
      },
    },
    "/v1/mail/board": {
      GET: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const store = getMailStore();
        const drafts = store.listNodes("draft");
        const scheduled = store.listNodes("scheduled");
        let recent: RecentMailCard[] = [];
        try {
          if (gmailStatus().connected) {
            const messages = await listMessagePreviews({
              maxResults: RECENT_FETCH_WINDOW,
              q: RECENT_INBOX_QUERY,
            });
            recent = pickRecentCards(messages);
          }
        } catch (err) {
          logs.append({
            kind: "error",
            level: "warn",
            title: "mail:recent",
            body: (err instanceof Error ? err.message : String(err)).slice(0, 400),
            source: "gmail",
          });
        }
        return json({ drafts, scheduled, recent });
      },
    },
    "/v1/mail/drafts/:id/send": {
      POST: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        if (!id) return json({ error: "id required" }, 400);
        try {
          const result = await sendDraft(id);
          if (result.alreadySent) {
            return json({ ok: true, alreadySent: true, draft: result.draft });
          }
          return json({ ok: true, id: result.sent.id, draft: result.draft });
        } catch (err) {
          if (err instanceof UnknownDraftError) {
            return json({ error: "Unknown draft" }, 404);
          }
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            500,
          );
        }
      },
    },
    "/v1/mail/drafts/:id": {
      GET: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        if (!id) return json({ error: "id required" }, 400);
        const draft = getMailStore().getNode(id);
        if (!draft) return json({ error: "Unknown draft" }, 404);
        return json({ draft });
      },
      DELETE: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        if (!id) return json({ error: "id required" }, 400);
        try {
          const draft = await discardDraft(id);
          return json({ ok: true, draft });
        } catch (err) {
          if (err instanceof UnknownDraftError) {
            return json({ error: "Unknown draft" }, 404);
          }
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            500,
          );
        }
      },
    },
    "/v1/mail/messages/:id": {
      GET: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        if (!id) return json({ error: "id required" }, 400);
        try {
          const message = await getMessage(id);
          return json({ message });
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            500,
          );
        }
      },
    },
    "/v1/skills": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        return json({
          skills: getSkills().map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
          })),
        });
      },
    },
    "/v1/ask": {
      POST: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const parsed = await readJson<AskHttpRequest>(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.body;
        if (!body.text?.trim()) return json({ error: "text is required" }, 400);
        const job = startJob(deps, {
          clientId: body.clientId || newClientId(),
          text: body.text.trim(),
          skillId: body.skillId,
          pageContext: body.pageContext,
          jobId: body.jobId,
        });
        return json({ jobId: job.id, status: job.status });
      },
    },
    "/v1/jobs": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const url = new URL(req.url);
        const status = url.searchParams.get("status") as
          | "queued"
          | "running"
          | "done"
          | "error"
          | null;
        const limit = Number(url.searchParams.get("limit") ?? 50);
        return json({
          jobs: jobs
            .list({
              status: status ?? undefined,
              limit: Number.isFinite(limit) ? limit : 50,
            })
            .map((job) => jobs.toHttp(job)),
        });
      },
    },
    "/v1/jobs/:id": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        const job = jobs.get(id);
        if (!job) return json({ error: "Not found" }, 404);
        return json(jobs.toHttp(job));
      },
    },
    "/v1/jobs/:id/events": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        if (!jobs.get(id)) return json({ error: "Not found" }, 404);
        const url = new URL(req.url);
        const limit = Number(url.searchParams.get("limit") ?? 100);
        return json({
          events: jobs.eventsFor(id, Number.isFinite(limit) ? limit : 100),
        });
      },
    },
    "/v1/logs": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const url = new URL(req.url);
        const kind = url.searchParams.get("kind") as
          | "job"
          | "tool"
          | "error"
          | "server"
          | null;
        const limit = Number(url.searchParams.get("limit") ?? 100);
        const before = url.searchParams.get("before");
        return json({
          events: logs.list({
            kind: kind ?? undefined,
            limit: Number.isFinite(limit) ? limit : 100,
            before: before ? Number(before) : undefined,
          }),
        });
      },
    },
    "/v1/collect-error": {
      GET: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const url = new URL(req.url);
        const limit = Number(url.searchParams.get("limit") ?? 50);
        try {
          const records = await errors.list(Number.isFinite(limit) ? limit : 50);
          return json({ records });
        } catch (err) {
          console.error("[collect-error] redis list failed", err);
          return json(
            { error: err instanceof Error ? err.message : "Failed to list errors" },
            503,
          );
        }
      },
      POST: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const parsed = await readJson<CollectErrorInput>(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.body;
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (!message) return json({ error: "message is required" }, 400);
        try {
          const record = await errors.save({
            message,
            code: typeof body.code === "string" ? body.code : undefined,
            source: typeof body.source === "string" ? body.source : undefined,
            clientId: typeof body.clientId === "string" ? body.clientId : undefined,
            jobId: typeof body.jobId === "string" ? body.jobId : undefined,
            url: typeof body.url === "string" ? body.url : undefined,
            stack: typeof body.stack === "string" ? body.stack : undefined,
            metadata:
              body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
                ? body.metadata
                : undefined,
          });
          return json({ id: record.id, createdAt: record.createdAt }, 201);
        } catch (err) {
          console.error("[collect-error] redis save failed", err);
          return json(
            { error: err instanceof Error ? err.message : "Failed to store error" },
            503,
          );
        }
      },
    },
    "/v1/collect-error/:id": {
      GET: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        try {
          const record = await errors.get(id);
          if (!record) return json({ error: "Not found" }, 404);
          return json({ record });
        } catch (err) {
          console.error("[collect-error] redis get failed", err);
          return json(
            { error: err instanceof Error ? err.message : "Failed to read error" },
            503,
          );
        }
      },
    },
    "/v1/schedule": {
      GET: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const url = new URL(req.url);
        const status = url.searchParams.get("status") as
          | "pending"
          | "running"
          | "done"
          | "cancelled"
          | "error"
          | null;
        const clientId = url.searchParams.get("clientId") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? 50);
        return json({
          tasks: await scheduler.list({
            status: status ?? undefined,
            clientId,
            limit: Number.isFinite(limit) ? limit : 50,
          }),
        });
      },
      POST: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const parsed = await readJson<ScheduleInput>(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.body;
        try {
          const task = await scheduler.schedule(body);
          return json({ task }, 201);
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            400,
          );
        }
      },
    },
    "/v1/schedule/:id": {
      GET: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        const task = await scheduler.get(id);
        if (!task) return json({ error: "Not found" }, 404);
        return json({ task });
      },
      DELETE: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        try {
          const task = await scheduler.cancel(id);
          if (!task) return json({ error: "Not found" }, 404);
          return json({ task });
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            400,
          );
        }
      },
    },
    "/v1/watchers": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const url = new URL(req.url);
        const status = url.searchParams.get("status") as WatcherStatus | null;
        const clientId = url.searchParams.get("clientId") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? 50);
        return json({
          watchers: watchers.list({
            status: status ?? undefined,
            clientId,
            limit: Number.isFinite(limit) ? limit : 50,
          }),
        });
      },
      POST: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const parsed = await readJson<WatcherInput>(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.body;
        try {
          const watcher = watchers.create(body);
          logs.append({
            kind: "server",
            level: "info",
            title: "watcher:create",
            body: watcher.title,
            clientId: watcher.clientId,
            source: "watchers",
          });
          return json({ watcher }, 201);
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            400,
          );
        }
      },
    },
    "/v1/watchers/:id": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        const watcher = watchers.get(id);
        if (!watcher) return json({ error: "Not found" }, 404);
        return json({ watcher });
      },
      PATCH: async (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        const parsed = await readJson<Partial<WatcherInput> & { status?: WatcherStatus }>(req);
        if (!parsed.ok) return parsed.response;
        const body = parsed.body;
        const watcher = watchers.update(id, {
          ...body,
          ...(body.status === "active" ? { nextCheckAt: Date.now(), lastError: undefined } : {}),
        });
        if (!watcher) return json({ error: "Not found" }, 404);
        return json({ watcher });
      },
      DELETE: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const id = (req as Request & { params: { id: string } }).params.id;
        if (!watchers.delete(id)) return json({ error: "Not found" }, 404);
        return json({ ok: true });
      },
    },
    "/v1/notify-queue": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        const url = new URL(req.url);
        const status = url.searchParams.get("status") as
          | "pending"
          | "delivered"
          | "skipped"
          | "failed"
          | null;
        const limit = Number(url.searchParams.get("limit") ?? 50);
        return json({
          events: notifyQueue.list({
            status: status ?? undefined,
            limit: Number.isFinite(limit) ? limit : 50,
          }),
        });
      },
    },
    "/v1/presence": {
      GET: (req: Request) => {
        const denied = requireAuth(req); if (denied) return denied;
        return json({
          anyOnline: clients.anyOnline(),
          clients: clients.presenceSnapshot(),
        });
      },
    },
    "/v1/ws": {
      GET: (req: Request, server: { upgrade: (req: Request, opts: { data: { authed: boolean; clientId: undefined } }) => boolean }) => {
        const token = extractBearer(req);
        if (!authorize(token)) {
          return json({ error: "Unauthorized" }, 401);
        }
        const upgraded = server.upgrade(req, {
          data: { authed: !config.cloudToken || Boolean(token), clientId: undefined },
        });
        if (!upgraded) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return undefined;
      },
    },
  };
}
