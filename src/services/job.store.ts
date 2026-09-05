import type {
  JobHttpResponse,
  JobStatus,
  JobToolCall,
  PageContext,
} from "../shared/agent";
import { newJobId } from "../shared/agent";

export type JobRecord = {
  id: string;
  clientId: string;
  status: JobStatus;
  text: string;
  skillId?: string;
  pageContext?: PageContext;
  content?: string;
  toolCalls?: JobToolCall[];
  error?: string;
  createdAt: number;
  updatedAt: number;
};

export type JobEvent = {
  id: string;
  jobId: string;
  at: number;
  kind: "status" | "tool" | "answer" | "error";
  message: string;
  payload?: unknown;
};

const EVENT_CAP = 200;

function newEventId() {
  return `jevt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export class JobStore {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly events = new Map<string, JobEvent[]>();

  create(input: {
    id?: string;
    clientId: string;
    text: string;
    skillId?: string;
    pageContext?: PageContext;
  }): JobRecord {
    const now = Date.now();
    const job: JobRecord = {
      id: input.id ?? newJobId(),
      clientId: input.clientId,
      status: "queued",
      text: input.text,
      skillId: input.skillId,
      pageContext: input.pageContext,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    this.events.set(job.id, []);
    this.appendEvent(job.id, {
      kind: "status",
      message: "queued",
    });
    return job;
  }

  get(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  list(opts?: { limit?: number; status?: JobStatus }): JobRecord[] {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    let rows = [...this.jobs.values()];
    if (opts?.status) rows = rows.filter((j) => j.status === opts.status);
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return rows.slice(0, limit);
  }

  update(id: string, patch: Partial<JobRecord>): JobRecord | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, patch, { updatedAt: Date.now() });
    return job;
  }

  appendEvent(
    jobId: string,
    input: Omit<JobEvent, "id" | "at" | "jobId"> & { at?: number },
  ): JobEvent | undefined {
    const list = this.events.get(jobId);
    if (!list) return undefined;
    const event: JobEvent = {
      id: newEventId(),
      jobId,
      at: input.at ?? Date.now(),
      kind: input.kind,
      message: input.message,
      payload: input.payload,
    };
    list.push(event);
    if (list.length > EVENT_CAP) list.splice(0, list.length - EVENT_CAP);
    return event;
  }

  eventsFor(jobId: string, limit = 100): JobEvent[] {
    const list = this.events.get(jobId) ?? [];
    const capped = Math.min(Math.max(limit, 1), EVENT_CAP);
    return list.slice(-capped).reverse();
  }

  toHttp(job: JobRecord): JobHttpResponse & {
    text?: string;
    clientId?: string;
    createdAt?: number;
    updatedAt?: number;
  } {
    return {
      jobId: job.id,
      status: job.status,
      content: job.content,
      skillId: job.skillId,
      toolCalls: job.toolCalls,
      error: job.error,
      pageContext: job.pageContext,
      text: job.text,
      clientId: job.clientId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
