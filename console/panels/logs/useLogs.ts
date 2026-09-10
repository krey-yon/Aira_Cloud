import { api } from "../../api/client";
import { parseLogList, type LogEvent } from "../../api/parse";
import type { LogFilter } from "../../shell/nav";
import { usePolled, type LoadState } from "../../shell/usePolled";

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
