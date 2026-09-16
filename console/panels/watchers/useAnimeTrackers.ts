import { api } from "../../api/client";
import { parseAnimeTrackerList, type AnimeTrackerView } from "../../api/parse";
import { usePolled, type LoadState } from "../../shell/usePolled";

export function useAnimeTrackers(enabled: boolean): LoadState<AnimeTrackerView[]> {
  return usePolled(enabled, "anime-trackers", async () => {
    const raw = await api<unknown>("/v1/anime-trackers?limit=100");
    return parseAnimeTrackerList(raw);
  });
}
