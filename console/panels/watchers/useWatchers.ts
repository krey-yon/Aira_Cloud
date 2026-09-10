import { api } from "../../api/client";
import { parseWatcherList, type WatcherView } from "../../api/parse";
import { usePolled, type LoadState } from "../../shell/usePolled";

export function useWatchers(enabled: boolean): LoadState<WatcherView[]> {
  return usePolled(enabled, "watchers", async () => {
    const raw = await api<unknown>("/v1/watchers?limit=100");
    return parseWatcherList(raw);
  });
}
