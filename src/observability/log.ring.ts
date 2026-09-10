export type ServerLogKind = "job" | "tool" | "error" | "server";
export type ServerLogLevel = "info" | "warn" | "error";

export type ServerLogRecord = {
  id: string;
  at: number;
  kind: ServerLogKind;
  level: ServerLogLevel;
  title: string;
  body: string;
  jobId?: string;
  clientId?: string;
  skillId?: string;
  source?: string;
};

const CAP = 500;

function newLogId() {
  return `log_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export class LogRing {
  private readonly records: ServerLogRecord[] = [];

  append(input: Omit<ServerLogRecord, "id" | "at"> & { at?: number; id?: string }): ServerLogRecord {
    const record: ServerLogRecord = {
      id: input.id ?? newLogId(),
      at: input.at ?? Date.now(),
      kind: input.kind,
      level: input.level,
      title: input.title,
      body: input.body,
      jobId: input.jobId,
      clientId: input.clientId,
      skillId: input.skillId,
      source: input.source,
    };
    this.records.push(record);
    if (this.records.length > CAP) {
      this.records.splice(0, this.records.length - CAP);
    }
    return record;
  }

  list(opts?: {
    kind?: ServerLogKind;
    limit?: number;
    before?: number;
  }): ServerLogRecord[] {
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 200);
    let rows = this.records;
    if (opts?.kind) rows = rows.filter((r) => r.kind === opts.kind);
    if (opts?.before != null) rows = rows.filter((r) => r.at < opts.before!);
    return rows.slice(-limit).reverse();
  }
}

let singleton: LogRing | null = null;

export function getLogRing(): LogRing {
  if (!singleton) singleton = new LogRing();
  return singleton;
}
