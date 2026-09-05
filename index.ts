import type { ServerWebSocket } from "bun";

import consoleIndex from "./console/index.html";
import type {
  AskHttpRequest,
  ClientToServerMessage,
  ServerToClientMessage,
} from "./src/shared/agent";
import { newClientId, newJobId } from "./src/shared/agent";
import { assertConfig, config } from "./src/config";
import { requestContext } from "./src/lib/request-context";
import { getScheduler, type ScheduleInput } from "./src/scheduler";
import { AgentService } from "./src/services/agent.service";
import { ClientRegistry, type SocketData } from "./src/services/client.registry";
import { ErrorStore, type CollectErrorInput } from "./src/services/error.store";
import { JobRunner } from "./src/services/job.runner";
import { JobStore } from "./src/services/job.store";
import { getLogRing } from "./src/services/log.ring";
import { getWatcherStore, type WatcherInput, type WatcherStatus } from "./src/services/watcher.store";
import { getSkills } from "./src/skills";

assertConfig();

const jobs = new JobStore();
const clients = new ClientRegistry();
const errors = new ErrorStore();
const runner = new JobRunner(jobs, clients);
const agent = new AgentService();
const scheduler = getScheduler();
const logs = getLogRing();
const watchers = getWatcherStore();

logs.append({
  kind: "server",
  level: "info",
  title: "boot",
  body: "Aira cloud agent starting",
  source: "server",
});

scheduler.setExecutor(async (task) => {
  logs.append({
    kind: "job",
    level: "info",
    title: `schedule:${task.title}`,
    body: "Running scheduled task",
    jobId: task.id,
    clientId: task.clientId,
    skillId: task.skillId,
    source: "scheduler",
  });

  if (task.clientId) {
    clients.send(task.clientId, {
      type: "widget",
      jobId: task.id,
      title: task.title,
      body: `Running scheduled task…`,
      kind: "status",
    });
  }

  try {
    const result = await requestContext.run(
      { clientId: task.clientId, jobId: task.id },
      () =>
        agent.run({
          skillId: task.skillId,
          messages: [
            {
              role: "user",
              content: [`Scheduled task: ${task.title}`, "", task.prompt].join("\n"),
            },
          ],
        }),
    );

    const body = result.content.trim() || `Finished: ${task.title}`;
    logs.append({
      kind: "job",
      level: "info",
      title: `schedule:${task.title}`,
      body: body.slice(0, 500),
      jobId: task.id,
      clientId: task.clientId,
      skillId: task.skillId,
      source: "scheduler",
    });
    if (task.clientId) {
      clients.send(task.clientId, {
        type: "widget",
        jobId: task.id,
        title: task.title,
        body: body.slice(0, 1600),
        kind: "answer",
      });
      clients.send(task.clientId, {
        type: "notify",
        jobId: task.id,
        title: task.title,
        body: body.slice(0, 180),
      });
    }

    return { result: body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.append({
      kind: "error",
      level: "error",
      title: `schedule:${task.title}`,
      body: message.slice(0, 800),
      jobId: task.id,
      clientId: task.clientId,
      source: "scheduler",
    });
    if (task.clientId) {
      clients.send(task.clientId, {
        type: "widget",
        jobId: task.id,
        title: `${task.title} failed`,
        body: message.slice(0, 800),
        kind: "error",
      });
    }
    return { error: message };
  }
});

scheduler.start();

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    },
  });
}

function extractBearer(req: Request): string | undefined {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match?.[1]) return match[1].trim();
  const url = new URL(req.url);
  return url.searchParams.get("token")?.trim() || undefined;
}

function authorize(token?: string): boolean {
  if (!config.cloudToken) return true;
  return Boolean(token && token === config.cloudToken);
}

function send(ws: ServerWebSocket<SocketData>, message: ServerToClientMessage) {
  ws.send(JSON.stringify(message));
}

function startJob(input: {
  clientId: string;
  text: string;
  skillId?: string;
  pageContext?: AskHttpRequest["pageContext"];
  jobId?: string;
}) {
  const job = jobs.create({
    id: input.jobId,
    clientId: input.clientId,
    text: input.text,
    skillId: input.skillId,
    pageContext: input.pageContext,
  });
  clients.send(job.clientId, { type: "accepted", jobId: job.id });
  clients.send(job.clientId, {
    type: "status",
    jobId: job.id,
    status: "queued",
    phase: "queued",
  });
  runner.enqueue(job.id);
  return job;
}

function handleClientMessage(ws: ServerWebSocket<SocketData>, raw: string | Buffer) {
  let message: ClientToServerMessage;
  try {
    message = JSON.parse(String(raw)) as ClientToServerMessage;
  } catch {
    send(ws, { type: "error", message: "Invalid JSON message" });
    return;
  }

  if (message.type === "hello") {
    if (!authorize(message.token)) {
      send(ws, { type: "error", message: "Unauthorized" });
      ws.close(1008, "Unauthorized");
      return;
    }
    ws.data.authed = true;
    clients.attach(message.clientId || newClientId(), ws);
    return;
  }

  if (!ws.data.authed && config.cloudToken) {
    send(ws, { type: "error", message: "Send hello with a valid token first" });
    return;
  }

  if (!ws.data.clientId) {
    clients.attach(newClientId(), ws);
    ws.data.authed = true;
  }

  if (message.type === "context") {
    return;
  }

  if (message.type === "ask") {
    if (!message.text?.trim()) {
      send(ws, { type: "error", jobId: message.jobId, message: "text is required" });
      return;
    }
    startJob({
      clientId: ws.data.clientId!,
      text: message.text.trim(),
      skillId: message.skillId,
      pageContext: message.pageContext,
      jobId: message.jobId || newJobId(),
    });
    return;
  }

  if (message.type === "cancel") {
    const job = jobs.get(message.jobId);
    if (!job || job.clientId !== ws.data.clientId) {
      send(ws, { type: "error", jobId: message.jobId, message: "Unknown job" });
      return;
    }
    if (job.status === "queued") {
      jobs.update(job.id, { status: "error", error: "Cancelled" });
      send(ws, { type: "error", jobId: job.id, message: "Cancelled" });
      send(ws, { type: "status", jobId: job.id, status: "error" });
    }
    return;
  }

  send(ws, { type: "error", message: `Unknown message type` });
}

const server = Bun.serve<SocketData>({
  port: config.port,
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": consoleIndex,
    "/health": {
      GET: () =>
        json({
          ok: true,
          service: "aira-on-cloud",
          authRequired: Boolean(config.cloudToken),
          scheduler: true,
          console: true,
        }),
    },
    "/v1/skills": {
      GET: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
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
      POST: async (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
        let body: AskHttpRequest;
        try {
          body = (await req.json()) as AskHttpRequest;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        if (!body.text?.trim()) return json({ error: "text is required" }, 400);
        const job = startJob({
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
      GET: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
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
      GET: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
        const id = (req as Request & { params: { id: string } }).params.id;
        const job = jobs.get(id);
        if (!job) return json({ error: "Not found" }, 404);
        return json(jobs.toHttp(job));
      },
    },
    "/v1/jobs/:id/events": {
      GET: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
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
      GET: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
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
      GET: async (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
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
      POST: async (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
        let body: CollectErrorInput;
        try {
          body = (await req.json()) as CollectErrorInput;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
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
      GET: async (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
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
      GET: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
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
          tasks: scheduler.list({
            status: status ?? undefined,
            clientId,
            limit: Number.isFinite(limit) ? limit : 50,
          }),
        });
      },
      POST: async (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
        let body: ScheduleInput;
        try {
          body = (await req.json()) as ScheduleInput;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        try {
          const task = scheduler.schedule(body);
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
      GET: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
        const id = (req as Request & { params: { id: string } }).params.id;
        const task = scheduler.get(id);
        if (!task) return json({ error: "Not found" }, 404);
        return json({ task });
      },
      DELETE: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
        const id = (req as Request & { params: { id: string } }).params.id;
        try {
          const task = scheduler.cancel(id);
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
      GET: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
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
      POST: async (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
        let body: WatcherInput;
        try {
          body = (await req.json()) as WatcherInput;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
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
      GET: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
        const id = (req as Request & { params: { id: string } }).params.id;
        const watcher = watchers.get(id);
        if (!watcher) return json({ error: "Not found" }, 404);
        return json({ watcher });
      },
      PATCH: async (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
        const id = (req as Request & { params: { id: string } }).params.id;
        let body: Partial<WatcherInput> & { status?: WatcherStatus };
        try {
          body = (await req.json()) as Partial<WatcherInput> & { status?: WatcherStatus };
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        const watcher = watchers.update(id, body);
        if (!watcher) return json({ error: "Not found" }, 404);
        return json({ watcher });
      },
      DELETE: (req) => {
        if (!authorize(extractBearer(req))) return json({ error: "Unauthorized" }, 401);
        const id = (req as Request & { params: { id: string } }).params.id;
        if (!watchers.delete(id)) return json({ error: "Not found" }, 404);
        return json({ ok: true });
      },
    },
    "/v1/ws": {
      GET: (req, server) => {
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
  },
  websocket: {
    open(ws) {
      if (ws.data.authed && !config.cloudToken) {
        clients.attach(newClientId(), ws);
      }
    },
    message(ws, message) {
      handleClientMessage(ws, message);
    },
    close(ws) {
      clients.detach(ws);
    },
  },
  fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(
  `Aira cloud agent listening on http://localhost:${server.port} (console /, ws /v1/ws, collect-error, scheduler, watchers)${
    config.cloudToken ? "" : " — CLOUD_TOKEN unset, auth disabled"
  }`,
);
