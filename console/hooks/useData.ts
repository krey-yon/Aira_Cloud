import { useEffect, useState } from "react";
import { api } from "../api/client";
import {
  parseLogList,
  parseTaskList,
  parseWatcherList,
  type LogEvent,
  type ScheduledTaskView,
  type WatcherView,
} from "../api/parse";
import type { LogFilter } from "../domain/nav";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

function usePolled<T>(
  enabled: boolean,
  key: string,
  loader: () => Promise<T>,
  intervalMs = 2000,
): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await loader();
        if (!cancelled) setState({ status: "ready", data });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, key, intervalMs]);

  return state;
}

function kindForFilter(filter: LogFilter): string | undefined {
  if (filter === "jobs") return "job";
  if (filter === "tools") return "tool";
  if (filter === "errors") return "error";
  if (filter === "server") return "server";
  return undefined;
}

export function useLogs(enabled: boolean, filter: LogFilter): LoadState<LogEvent[]> {
  const kind = kindForFilter(filter);
  return usePolled(enabled, `logs:${filter}`, async () => {
    const qs = kind ? `?kind=${kind}&limit=100` : "?limit=100";
    const raw = await api<unknown>(`/v1/logs${qs}`);
    return parseLogList(raw);
  });
}

export function useSchedule(enabled: boolean): LoadState<ScheduledTaskView[]> {
  return usePolled(enabled, "schedule", async () => {
    const raw = await api<unknown>("/v1/schedule?limit=100");
    return parseTaskList(raw);
  });
}

export function useWatchers(enabled: boolean): LoadState<WatcherView[]> {
  return usePolled(enabled, "watchers", async () => {
    const raw = await api<unknown>("/v1/watchers?limit=100");
    return parseWatcherList(raw);
  });
}
