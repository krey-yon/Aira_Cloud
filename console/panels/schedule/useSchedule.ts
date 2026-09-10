import { api } from "../../api/client";
import { parseTaskList, type ScheduledTaskView } from "../../api/parse";
import { usePolled, type LoadState } from "../../shell/usePolled";

export function useSchedule(enabled: boolean): LoadState<ScheduledTaskView[]> {
  return usePolled(enabled, "schedule", async () => {
    const raw = await api<unknown>("/v1/schedule?limit=100");
    return parseTaskList(raw);
  });
}
