import type { PageContext, WidgetAction, WidgetKind } from "../shared/agent";
import { extractAskUser } from "../shared/ask-user-parse";
import { previewWords, shouldUseCanvas } from "../shared/canvas";
import {
  actionsFromText,
  pickBodyFormat,
  presentBody,
} from "../shared/widget";
import { config } from "../config";
import { requestContext } from "../lib/request-context";
import type { AgentRequest } from "../types";
import { AgentService } from "./agent.service";
import { getCanvasStore } from "./canvas.store";
import type { ClientRegistry } from "./client.registry";
import type { JobRecord, JobStore } from "./job.store";
import { getLogRing } from "./log.ring";
import { askUser } from "./question.bridge";

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

function publicOrigin(): string {
  const configured = config.publicBaseUrl.trim().replace(/\/$/, "");
  if (configured) return configured;
  return `http://localhost:${config.port}`;
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
  private readonly canvases = getCanvasStore();
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
    const raw = content.trim() || "Done.";
    const useCanvas = shouldUseCanvas(raw, config.canvasWordCap);
    const format = pickBodyFormat(raw, { canvas: useCanvas });
    let widgetBody = presentBody(raw, format);
    let canvasUrl: string | undefined;
    let kind: WidgetKind = "answer";
    let actions: WidgetAction[] = actionsFromText(raw);

    if (useCanvas) {
      const record = this.canvases.put({ markdown: raw, title });
      canvasUrl = `${publicOrigin()}/r/${record.id}`;
      widgetBody = previewWords(raw);
      actions = [
        {
          id: "open_canvas",
          label: "Open full answer",
          kind: "link",
          url: canvasUrl,
          style: "primary",
        },
        ...actions.filter((a) => a.url !== canvasUrl),
      ];
    }

    this.emit(job, {
      type: "widget",
      jobId: job.id,
      title,
      body: widgetBody.slice(0, 1600),
      kind,
      format,
      actions,
      ...(canvasUrl ? { canvasUrl } : {}),
    });
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

      this.jobs.update(job.id, {
        status: "done",
        content: result.content,
        skillId: result.skillId,
        toolCalls: result.toolCalls,
      });

      this.note(job, "answer", "done", result.content.slice(0, 500));
      this.emit(job, {
        type: "answer",
        jobId: job.id,
        content: result.content,
        skillId: result.skillId,
      });

      // Models sometimes dump <ask_user> JSON as prose instead of calling the tool.
      // Promote that into a real question widget and wait for the human.
      const leaked = extractAskUser(result.content);
      if (leaked) {
        this.note(job, "tool", "ask_user", { source: "text-fallback", prompt: leaked.prompt });
        const reply = await askUser({
          prompt: leaked.prompt,
          options: leaked.options,
          allowFreeText: leaked.allowFreeText,
          placeholder: leaked.placeholder,
        });
        const choice = reply.text?.trim() || reply.label;
        const followUp = [leaked.remainder, leaked.remainder ? "" : "", `Got “${choice}”.`].join("\n").trim();
        this.presentAnswer(job, followUp || `Got “${choice}”.`);
        this.emit(job, {
          type: "notify",
          jobId: job.id,
          title: "Aira finished",
          body: (followUp || choice).slice(0, 180),
        });
      } else {
        const body = result.content.trim() || "Done.";
        this.presentAnswer(job, body);
        this.emit(job, {
          type: "notify",
          jobId: job.id,
          title: "Aira finished",
          body: body.slice(0, 180),
        });
      }

      this.emit(job, { type: "status", jobId: job.id, status: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.jobs.update(job.id, { status: "error", error: message });
      this.note(job, "error", message);
      this.emit(job, { type: "error", jobId: job.id, message });
      this.emit(job, {
        type: "widget",
        jobId: job.id,
        title: "Aira failed",
        body: message.slice(0, 800),
        kind: "error",
        format: "plain",
        actions: [{ id: "dismiss", label: "Dismiss", kind: "dismiss", style: "secondary" }],
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
