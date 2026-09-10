import type { ServerWebSocket } from "bun";

import type { AskHttpRequest, ClientToServerMessage, ServerToClientMessage } from "../shared/agent";
import { newClientId, newJobId } from "../shared/agent";
import { config } from "../config";
import { authorize } from "./auth";
import type { AppDeps } from "./deps";
import type { SocketData } from "../realtime/client.registry";
import { resolveQuestionReply } from "../questions/question.bridge";

export function send(ws: ServerWebSocket<SocketData>, message: ServerToClientMessage) {
  ws.send(JSON.stringify(message));
}

export function startJob(
  deps: AppDeps,
  input: {
    clientId: string;
    text: string;
    skillId?: string;
    pageContext?: AskHttpRequest["pageContext"];
    jobId?: string;
  },
) {
  const job = deps.jobs.create({
    id: input.jobId,
    clientId: input.clientId,
    text: input.text,
    skillId: input.skillId,
    pageContext: input.pageContext,
  });
  deps.clients.send(job.clientId, { type: "accepted", jobId: job.id });
  deps.clients.send(job.clientId, {
    type: "status",
    jobId: job.id,
    status: "queued",
    phase: "queued",
  });
  deps.runner.enqueue(job.id);
  return job;
}

export function handleClientMessage(
  deps: AppDeps,
  ws: ServerWebSocket<SocketData>,
  raw: string | Buffer,
) {
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
    const clientId = message.clientId || newClientId();
    deps.clients.attach(clientId, ws);
    void deps.watcherRunner.onClientPresent(clientId);
    return;
  }

  if (!ws.data.authed && config.cloudToken) {
    send(ws, { type: "error", message: "Send hello with a valid token first" });
    return;
  }

  if (!ws.data.clientId) {
    deps.clients.attach(newClientId(), ws);
    ws.data.authed = true;
  }

  if (message.type === "heartbeat") {
    const clientId = message.clientId || ws.data.clientId;
    if (clientId) {
      deps.clients.touch(clientId);
      void deps.watcherRunner.onClientPresent(clientId);
    }
    return;
  }

  if (message.type === "context") {
    return;
  }

  if (message.type === "ask") {
    if (!message.text?.trim()) {
      send(ws, { type: "error", jobId: message.jobId, message: "text is required" });
      return;
    }
    startJob(deps, {
      clientId: ws.data.clientId!,
      text: message.text.trim(),
      skillId: message.skillId,
      pageContext: message.pageContext,
      jobId: message.jobId || newJobId(),
    });
    return;
  }

  if (message.type === "cancel") {
    const job = deps.jobs.get(message.jobId);
    if (!job || job.clientId !== ws.data.clientId) {
      send(ws, { type: "error", jobId: message.jobId, message: "Unknown job" });
      return;
    }
    if (job.status === "queued") {
      deps.jobs.update(job.id, { status: "error", error: "Cancelled" });
      send(ws, { type: "error", jobId: job.id, message: "Cancelled" });
      send(ws, { type: "status", jobId: job.id, status: "error" });
    }
    return;
  }

  if (message.type === "question_reply") {
    const ok = resolveQuestionReply({
      questionId: message.questionId,
      optionId: message.optionId,
      label: message.label,
      text: message.text,
    });
    if (!ok) {
      send(ws, {
        type: "error",
        jobId: message.jobId,
        message: "No pending question for that id",
      });
    }
    return;
  }

  send(ws, { type: "error", message: `Unknown message type` });
}
