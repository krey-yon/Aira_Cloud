import type {
  JobHttpResponse,
  JobStatus,
  JobToolCall,
  PageContext,
} from "../../../shared/agent";
import { newJobId } from "../../../shared/agent";

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

export class JobStore {
  private readonly jobs = new Map<string, JobRecord>();

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
    return job;
  }

  get(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  update(id: string, patch: Partial<JobRecord>): JobRecord | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, patch, { updatedAt: Date.now() });
    return job;
  }

  toHttp(job: JobRecord): JobHttpResponse {
    return {
      jobId: job.id,
      status: job.status,
      content: job.content,
      skillId: job.skillId,
      toolCalls: job.toolCalls,
      error: job.error,
      pageContext: job.pageContext,
    };
  }
}
