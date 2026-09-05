/** Wire protocol between the extension and the cloud agent brain. */

export type PageContext = {
  url: string;
  title: string;
  domain?: string;
};

export type JobStatus = "queued" | "running" | "done" | "error";

export type JobToolCall = {
  name: string;
  arguments: string;
  result: unknown;
};

export type AgentQuestionOption = {
  id: string;
  label: string;
};

/**
 * Generic action chip/button on the floating widget.
 * Server or extension can attach these; the content UI renders them uniformly.
 */
export type WidgetAction = {
  id: string;
  label: string;
  /** link opens url; dismiss clears widget; reply sends question_reply; command is reserved */
  kind: "link" | "dismiss" | "reply" | "command";
  url?: string;
  style?: "primary" | "secondary" | "danger";
  /** For kind=reply — option id sent back to the cloud */
  optionId?: string;
};

export type WidgetBodyFormat = "plain" | "markdown";

export type WidgetKind =
  | "ack"
  | "answer"
  | "error"
  | "nudge"
  | "question"
  | "progress"
  | "hidden";

/** Extension → cloud */
export type ClientToServerMessage =
  | { type: "hello"; clientId: string; token?: string }
  | { type: "context"; url: string; title: string; tabId?: number }
  | {
      type: "ask";
      jobId: string;
      text: string;
      skillId?: string;
      pageContext?: PageContext;
    }
  | { type: "cancel"; jobId: string }
  | {
      type: "question_reply";
      jobId: string;
      questionId: string;
      optionId?: string;
      label?: string;
      /** Free-text answer when the human typed instead of picking a chip */
      text?: string;
    };

/** Cloud → extension */
export type ServerToClientMessage =
  | { type: "accepted"; jobId: string }
  | { type: "status"; jobId: string; status: JobStatus; phase?: string }
  | {
      type: "tool";
      jobId: string;
      name: string;
      arguments?: string;
      result?: unknown;
    }
  | { type: "answer"; jobId: string; content: string; skillId?: string }
  | { type: "error"; jobId?: string; message: string }
  | {
      type: "notify";
      jobId: string;
      title: string;
      body: string;
    }
  | {
      type: "widget";
      jobId?: string;
      title: string;
      body: string;
      kind?: WidgetKind;
      startFlow?: boolean;
      canvasUrl?: string;
      questionId?: string;
      options?: AgentQuestionOption[];
      /** OpenCode-style free-text field under the options */
      allowFreeText?: boolean;
      placeholder?: string;
      actions?: WidgetAction[];
      format?: WidgetBodyFormat;
      /** Auto-clear the widget after N ms (ack/progress). 0 = keep until replaced. */
      dismissAfterMs?: number;
      /** Force-clear any widget for this job (or the current one if no jobId). */
      dismiss?: boolean;
    }
  | { type: "nudge"; reason: string; message: string };

export type AskHttpRequest = {
  text: string;
  skillId?: string;
  pageContext?: PageContext;
  clientId?: string;
  jobId?: string;
};

export type AskHttpResponse = {
  jobId: string;
  status: JobStatus;
};

export type JobHttpResponse = {
  jobId: string;
  status: JobStatus;
  content?: string;
  skillId?: string;
  toolCalls?: JobToolCall[];
  error?: string;
  pageContext?: PageContext;
};

export function newJobId(): string {
  return `job_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function newClientId(): string {
  return `ext_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function newQuestionId(): string {
  return `q_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function newCanvasId(): string {
  return `cv_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
