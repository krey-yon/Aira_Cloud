import { presentAnswer, presentError } from "../agent/present-answer";
import type { AgentService } from "../agent/agent.service";
import { requestContext } from "../realtime/request-context";
import { sendDraft } from "../mail/mail.lifecycle";
import type { LogRing } from "../observability/log.ring";
import type { ClientRegistry } from "../realtime/client.registry";
import type { ScheduledTask } from "./types";

export type SchedulerExecutorDeps = {
  logs: LogRing;
  clients: ClientRegistry;
  agent: AgentService;
};

export function createSchedulerExecutor(deps: SchedulerExecutorDeps) {
  const { logs, clients, agent } = deps;

  return async (task: ScheduledTask) => {
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
        body: "Queued. Working in the background.",
        kind: "ack",
        format: "plain",
        dismissAfterMs: 2500,
      });
    }

    try {
      const mailAction = task.metadata?.mailAction;
      const draftId =
        typeof task.metadata?.draftId === "string" ? task.metadata.draftId : null;

      if (mailAction === "send_draft" && draftId) {
        const sentDraft = await sendDraft(draftId);
        if (sentDraft.alreadySent) {
          return { result: `Already sent draft ${draftId}` };
        }
        const body = `Sent “${sentDraft.draft.subject}” to ${sentDraft.draft.to.join(", ")}`;
        logs.append({
          kind: "job",
          level: "info",
          title: `schedule:${task.title}`,
          body,
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
            body,
            kind: "answer",
            format: "plain",
          });
          clients.send(task.clientId, {
            type: "notify",
            jobId: task.id,
            title: task.title,
            body: body.slice(0, 180),
          });
        }
        return { result: body };
      }

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
        const presented = presentAnswer({
          jobId: task.id,
          content: body,
          title: task.title,
        });
        clients.send(task.clientId, presented.widget);
        clients.send(task.clientId, presented.notify);
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
        const failed = presentError({
          jobId: task.id,
          message,
          title: `${task.title} failed`,
        });
        clients.send(task.clientId, failed.widget);
      }
      return { error: message };
    }
  };
}
