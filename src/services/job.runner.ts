import type { PageContext } from "../shared/agent";
import { requestContext } from "../lib/request-context";
import type { AgentRequest } from "../types";
import { AgentService } from "./agent.service";
import type { ClientRegistry } from "./client.registry";
import type { JobRecord, JobStore } from "./job.store";

function buildUserContent(text: string, pageContext?: PageContext): string {
  if (!pageContext?.url) return text;
  const lines = [
    text,
    "",
    "---",
    "Current page context (from the browser extension):",
    `Title: ${pageContext.title || "(untitled)"}`,
    `URL: ${pageContext.url}`,
  ];
  if (pageContext.domain) lines.push(`Domain: ${pageContext.domain}`);
  lines.push(
    "",
    "Use websearch/webfetch when you need to research this page or product.",
  );
  return lines.join("\n");
}

export class JobRunner {
  private readonly queue: string[] = [];
  private running = false;

  constructor(
    private readonly jobs: JobStore,
    private readonly clients: ClientRegistry,
    private readonly agent = new AgentService(),
  ) {}

  enqueue(jobId: string) {
    this.queue.push(jobId);
    void this.pump();
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const jobId = this.queue.shift()!;
        const job = this.jobs.get(jobId);
        if (!job || job.status === "done" || job.status === "error") continue;
        await this.runOne(job);
      }
    } finally {
      this.running = false;
    }
  }

  private emit(job: JobRecord, message: Parameters<ClientRegistry["send"]>[1]) {
    this.clients.send(job.clientId, message);
  }

  private async runOne(job: JobRecord) {
    this.jobs.update(job.id, { status: "running" });
    this.emit(job, { type: "status", jobId: job.id, status: "running", phase: "researching" });

    try {
      const request: AgentRequest = {
        skillId: job.skillId,
        messages: [
          {
            role: "user",
            content: buildUserContent(job.text, job.pageContext),
          },
        ],
      };

      const result = await requestContext.run(
        { clientId: job.clientId, jobId: job.id },
        () => this.agent.run(request),
      );

      if (result.toolCalls?.length) {
        for (const call of result.toolCalls) {
          this.emit(job, {
            type: "tool",
            jobId: job.id,
            name: call.name,
            arguments: call.arguments,
            result: call.result,
          });
        }
      }

      this.jobs.update(job.id, {
        status: "done",
        content: result.content,
        skillId: result.skillId,
        toolCalls: result.toolCalls,
      });

      this.emit(job, {
        type: "answer",
        jobId: job.id,
        content: result.content,
        skillId: result.skillId,
      });

      const body = result.content.trim() || "Research finished.";
      this.emit(job, {
        type: "widget",
        jobId: job.id,
        title: "Aira",
        body: body.slice(0, 1600),
        kind: "answer",
      });
      this.emit(job, {
        type: "notify",
        jobId: job.id,
        title: "Aira finished",
        body: body.slice(0, 180),
      });

      this.emit(job, { type: "status", jobId: job.id, status: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.jobs.update(job.id, { status: "error", error: message });
      this.emit(job, { type: "error", jobId: job.id, message });
      this.emit(job, {
        type: "widget",
        jobId: job.id,
        title: "Aira failed",
        body: message.slice(0, 800),
        kind: "error",
      });
      this.emit(job, {
        type: "notify",
        jobId: job.id,
        title: "Aira failed",
        body: message.slice(0, 180),
      });
      this.emit(job, { type: "status", jobId: job.id, status: "error" });
    }
  }
}
