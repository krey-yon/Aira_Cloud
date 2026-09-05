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
  | { type: "cancel"; jobId: string };

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
  /** Show / update the extension floating widget */
  | {
      type: "widget";
      jobId?: string;
      title: string;
      body: string;
      kind?: "answer" | "error" | "nudge" | "status";
      /** Ask the extension to start Flow when presenting this message */
      startFlow?: boolean;
    }
  /** Reserved for proactive watching — also surfaces on the floating widget */
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
