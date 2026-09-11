import { ClientRegistry, type SocketData } from "./src/realtime/client.registry";
import { config } from "./src/config";
import { getScheduler } from "./src/scheduler";
import { AgentService } from "./src/agent/agent.service";
import { ErrorStore } from "./src/observability/error.store";
import { JobRunner } from "./src/agent/job.runner";
import { JobStore } from "./src/agent/job.store";
import { getLogRing } from "./src/observability/log.ring";
import { getCanvasStore } from "./src/canvas/canvas.store";
import { initSkills } from "./src/skills";
import { getNotifyQueue } from "./src/watchers/notify.queue";
import { bindQuestionBridge } from "./src/questions/question.bridge";
import { getWatcherRunner } from "./src/watchers/watcher.runner";
import { ensureSolanaIndiaGrantsWatcher } from "./src/watchers/watcher.seeds";
import { getWatcherStore } from "./src/watchers/watcher.store";
import { newClientId } from "./src/shared/agent";
import type { AppDeps } from "./src/http/deps";
import { createRoutes } from "./src/http/routes";
import { handleClientMessage } from "./src/http/ws";
import { createSchedulerExecutor } from "./src/scheduler/executor";

if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
  console.warn(
    "[aira] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN missing — agent LLM calls will fail until set.",
  );
}

await initSkills();

const jobs = new JobStore();
const clients = new ClientRegistry();
const errors = new ErrorStore();
const agent = new AgentService();
const runner = new JobRunner(jobs, clients, agent);
const scheduler = getScheduler();
const logs = getLogRing();
const watchers = getWatcherStore();
const notifyQueue = getNotifyQueue();
const watcherRunner = getWatcherRunner(clients);
const canvases = getCanvasStore();
bindQuestionBridge(clients);

logs.append({
  kind: "server",
  level: "info",
  title: "boot",
  body: "Aira cloud agent starting",
  source: "server",
});

scheduler.setExecutor(createSchedulerExecutor({ logs, clients, agent }));
scheduler.start();
ensureSolanaIndiaGrantsWatcher();
watcherRunner.start(config.watcherTickMs);

const deps: AppDeps = {
  jobs,
  clients,
  errors,
  runner,
  scheduler,
  logs,
  watchers,
  notifyQueue,
  watcherRunner,
  canvases,
};

const server = Bun.serve<SocketData>({
  port: config.port,
  development: process.env.NODE_ENV !== "production",
  routes: createRoutes(deps),
  websocket: {
    open(ws) {
      if (ws.data.authed && !config.cloudToken) {
        clients.attach(newClientId(), ws);
      }
    },
    message(ws, message) {
      handleClientMessage(deps, ws, message);
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
