import type { PageContext } from "../shared/agent";
import { extractAskUser } from "../shared/ask-user-parse";
import {
  scheduleToolSucceeded,
  wantsSchedule,
} from "./schedule-intent";
import { requestContext } from "../realtime/request-context";
import type { AgentRequest } from "./types";
import { AgentService } from "./agent.service";
import type { ClientRegistry } from "../realtime/client.registry";
import type { JobRecord, JobStore } from "./job.store";
import { getLogRing } from "../observability/log.ring";
import { presentAnswer, presentError } from "./present-answer";
import { askUser } from "../questions/question.bridge";

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
    "Do not nudge with questions. Call ask_user only if truly blocked; at most 1–2 asks total (options + optional free text).",
    "Never write <ask_user> tags or JSON question blocks in your final answer — only call the tool.",
  );
  return lines.join("\n");
}

function toolTitle(name: string): string {
  const map: Record<string, string> = {
    ask_user: "Asking you a question",
    websearch: "Searching the web",
    webfetch: "Reading a page",
    notion_create_page: "Creating a Notion page",
    notion_write_page: "Writing Notion content",
    notion_search: "Searching Notion",
    notion_read_page: "Reading a Notion page",
    notion_update_page: "Updating Notion",
    notion_create_database: "Creating a Notion database",
    schedule_task: "Scheduling a task",
    list_scheduled_tasks: "Listing scheduled tasks",
    cancel_scheduled_task: "Cancelling a scheduled task",
  };
  return map[name] ?? `Running ${name}`;
}

function summarizeToolResult(name: string, result: unknown): string {
  if (result == null) return "done";
  if (typeof result === "string") return result.slice(0, 280);
  try {
    const json = JSON.stringify(result);
    if (name.startsWith("notion_") && json.includes("url")) {
      const match = json.match(/https?:\/\/[^"\\]+/);
      if (match) return match[0];
    }
    return json.slice(0, 280);
  } catch {
    return "done";
  }
}

export class JobRunner {
  private readonly queue: string[] = [];
  private readonly logs = getLogRing();
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

  private note(
    job: JobRecord,
    kind: "status" | "tool" | "answer" | "error" | "thinking",
    message: string,
    payload?: unknown,
  ) {
    this.jobs.appendEvent(job.id, { kind, message, payload });
    const title =
      kind === "tool"
        ? `Tool · ${toolTitle(message)}`
        : kind === "thinking"
          ? "Thinking"
          : kind === "status"
            ? `Job ${job.status === "running" ? "started" : job.status}`
            : kind === "answer"
              ? "Answer ready"
              : "Job failed";

    let body = message;
    if (kind === "tool") {
      const args =
        payload && typeof payload === "object" && "arguments" in payload
          ? String((payload as { arguments?: unknown }).arguments ?? "")
          : "";
      const result =
        payload && typeof payload === "object" && "result" in payload
          ? (payload as { result?: unknown }).result
          : payload;
      body = [
        args ? `Args: ${args.slice(0, 400)}` : null,
        `Result: ${summarizeToolResult(message, result)}`,
      ]
        .filter(Boolean)
        .join("\n");
    } else if (typeof payload === "string") {
      body = payload;
    } else if (payload != null && kind !== "thinking") {
      try {
        body = JSON.stringify(payload).slice(0, 500);
      } catch {
        body = message;
      }
    }

    this.logs.append({
      kind: kind === "tool" ? "tool" : kind === "error" ? "error" : "job",
      level: kind === "error" ? "error" : "info",
      title,
      body: body.slice(0, 2000),
      jobId: job.id,
      clientId: job.clientId,
      skillId: job.skillId,
      source: kind === "thinking" ? "thinking" : "runner",
    });
  }

  private presentAnswer(job: JobRecord, content: string, title = "Aira") {
    const presented = presentAnswer({
      jobId: job.id,
      content,
      title,
      notifyTitle: "Aira finished",
    });
    this.emit(job, presented.widget);
    return presented;
  }

  private async runOne(job: JobRecord) {
    this.jobs.update(job.id, { status: "running" });
    this.note(job, "status", "running");
    this.logs.append({
      kind: "job",
      level: "info",
      title: "Task received",
      body: job.text.slice(0, 400),
      jobId: job.id,
      clientId: job.clientId,
      skillId: job.skillId,
      source: "runner",
    });
    // Status stays on the wire for diagnostics; do not spam the widget with "researching".
    this.emit(job, { type: "status", jobId: job.id, status: "running", phase: "working" });

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
        () =>
          this.agent.run(request, {
            onThinking: (text) => {
              this.note(job, "thinking", text);
            },
            onTools: (tools) => {
              for (const call of tools) {
                this.note(job, "tool", call.name, {
                  arguments: call.arguments,
                  result: call.result,
                });
                this.emit(job, {
                  type: "tool",
                  jobId: job.id,
                  name: call.name,
                  arguments: call.arguments,
                  result: call.result,
                });
                // Quiet progress pulse — auto-dismisses; never stuck "On it".
                if (call.name !== "ask_user") {
                  this.emit(job, {
                    type: "widget",
                    jobId: job.id,
                    title: "Aira",
                    body: toolTitle(call.name),
                    kind: "progress",
                    format: "plain",
                    dismissAfterMs: 3500,
                  });
                }
              }
            },
          }),
      );

      const askUserFromProse = extractAskUser(result.content);
      let content = result.content;
      if (
        !askUserFromProse &&
        wantsSchedule(job.text) &&
        !scheduleToolSucceeded(result.toolCalls)
      ) {
        content =
          "Scheduling did not happen. The schedule_task tool was not called or it returned ok: false, so nothing was added to the queue.";
        this.note(
          job,
          "status",
          "schedule_task missing or failed; not claiming success",
        );
      }

      this.jobs.update(job.id, {
        status: "done",
        content,
        skillId: result.skillId,
        toolCalls: result.toolCalls,
      });

      if (result.plan || result.skillIds?.length) {
        this.note(job, "status", result.plan ?? "planned", {
          skillIds: result.skillIds,
        });
      }
      if (result.artifacts?.length) {
        this.note(job, "status", "artifacts", { artifacts: result.artifacts });
      }

      this.note(job, "answer", "done", content.slice(0, 500));
      this.emit(job, {
        type: "answer",
        jobId: job.id,
        content,
        skillId: result.skillId,
      });

      if (askUserFromProse) {
        this.note(job, "tool", "ask_user", {
          source: "text-fallback",
          prompt: askUserFromProse.prompt,
        });
        const reply = await askUser({
          prompt: askUserFromProse.prompt,
          options: askUserFromProse.options,
          allowFreeText: askUserFromProse.allowFreeText,
          placeholder: askUserFromProse.placeholder,
        });
        const choice = reply.text?.trim() || reply.label;
        const continued = await requestContext.run(
          { clientId: job.clientId, jobId: job.id },
          () =>
            this.agent.run({
              skillId: result.skillId,
              messages: [
                {
                  role: "user",
                  content: buildUserContent(job.text, job.pageContext),
                },
                {
                  role: "assistant",
                  content: askUserFromProse.remainder || content,
                },
                {
                  role: "user",
                  content: `My answer to your question ("${askUserFromProse.prompt}"): ${choice}`,
                },
              ],
            }),
        );
        content = continued.content;
        this.jobs.update(job.id, {
          status: "done",
          content,
          skillId: continued.skillId,
          toolCalls: continued.toolCalls,
        });
        this.emit(job, {
          type: "answer",
          jobId: job.id,
          content,
          skillId: continued.skillId,
        });
        const presented = this.presentAnswer(job, content.trim() || "Done.");
        this.emit(job, presented.notify);
      } else {
        const body = content.trim() || "Done.";
        const presented = this.presentAnswer(job, body);
        this.emit(job, presented.notify);
      }

      this.emit(job, { type: "status", jobId: job.id, status: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.jobs.update(job.id, { status: "error", error: message });
      this.note(job, "error", message);
      this.emit(job, { type: "error", jobId: job.id, message });
      const failed = presentError({ jobId: job.id, message });
      this.emit(job, failed.widget);
      this.emit(job, failed.notify);
      this.emit(job, { type: "status", jobId: job.id, status: "error" });
    }
  }
}
