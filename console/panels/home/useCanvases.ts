import { api } from "../../api/client";
import { parseCanvasList, type CanvasPageView } from "../../api/parse";
import { usePolled, type LoadState } from "../../shell/usePolled";

export function useCanvases(enabled: boolean): LoadState<CanvasPageView[]> {
  return usePolled(enabled, "canvases", async () => {
    const raw = await api<unknown>("/v1/canvases?limit=8");
    return parseCanvasList(raw);
  }, 15_000);
}
