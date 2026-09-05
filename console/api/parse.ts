export type LogKind = "job" | "tool" | "error" | "server";
export type LogLevel = "info" | "warn" | "error";

export type LogEvent = {
  id: string;
  at: number;
  kind: LogKind;
  level: LogLevel;
  title: string;
  body: string;
  jobId?: string;
  clientId?: string;
  skillId?: string;
  source?: string;
};

export type ScheduledTaskView = {
  id: string;
  title: string;
  prompt: string;
  runAt: string;
  status: string;
  clientId?: string;
  skillId?: string;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type WatcherView = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  clientId?: string;
  skillId?: string;
  lastFiredAt?: number;
  lastNudge?: string;
  createdAt: number;
  updatedAt: number;
};

export function parseLogEvent(raw: unknown): LogEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.at !== "number" || typeof o.title !== "string") {
    return null;
  }
  const kind = o.kind;
  if (kind !== "job" && kind !== "tool" && kind !== "error" && kind !== "server") return null;
  return {
    id: o.id,
    at: o.at,
    kind,
    level: o.level === "warn" || o.level === "error" ? o.level : "info",
    title: o.title,
    body: typeof o.body === "string" ? o.body : "",
    jobId: typeof o.jobId === "string" ? o.jobId : undefined,
    clientId: typeof o.clientId === "string" ? o.clientId : undefined,
    skillId: typeof o.skillId === "string" ? o.skillId : undefined,
    source: typeof o.source === "string" ? o.source : undefined,
  };
}

export function parseLogList(raw: unknown): LogEvent[] {
  if (!raw || typeof raw !== "object") return [];
  const events = (raw as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  return events.map(parseLogEvent).filter((e): e is LogEvent => e != null);
}

export function parseTask(raw: unknown): ScheduledTaskView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return null;
  return {
    id: o.id,
    title: o.title,
    prompt: typeof o.prompt === "string" ? o.prompt : "",
    runAt: typeof o.runAt === "string" ? o.runAt : "",
    status: typeof o.status === "string" ? o.status : "pending",
    clientId: typeof o.clientId === "string" ? o.clientId : undefined,
    skillId: typeof o.skillId === "string" ? o.skillId : undefined,
    result: typeof o.result === "string" ? o.result : undefined,
    error: typeof o.error === "string" ? o.error : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
  };
}

export function parseTaskList(raw: unknown): ScheduledTaskView[] {
  if (!raw || typeof raw !== "object") return [];
  const tasks = (raw as { tasks?: unknown }).tasks;
  if (!Array.isArray(tasks)) return [];
  return tasks.map(parseTask).filter((t): t is ScheduledTaskView => t != null);
}

export function parseWatcher(raw: unknown): WatcherView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return null;
  return {
    id: o.id,
    title: o.title,
    prompt: typeof o.prompt === "string" ? o.prompt : "",
    status: typeof o.status === "string" ? o.status : "active",
    clientId: typeof o.clientId === "string" ? o.clientId : undefined,
    skillId: typeof o.skillId === "string" ? o.skillId : undefined,
    lastFiredAt: typeof o.lastFiredAt === "number" ? o.lastFiredAt : undefined,
    lastNudge: typeof o.lastNudge === "string" ? o.lastNudge : undefined,
    createdAt: typeof o.createdAt === "number" ? o.createdAt : 0,
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : 0,
  };
}

export function parseWatcherList(raw: unknown): WatcherView[] {
  if (!raw || typeof raw !== "object") return [];
  const watchers = (raw as { watchers?: unknown }).watchers;
  if (!Array.isArray(watchers)) return [];
  return watchers.map(parseWatcher).filter((w): w is WatcherView => w != null);
}
