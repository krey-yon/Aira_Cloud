export type PanelId = "logs" | "schedule" | "watchers" | "errors";

export type LogFilter = "all" | "jobs" | "tools" | "errors" | "server";

export type ConsoleNav =
  | { panel: "idle" }
  | { panel: "logs"; filter: LogFilter; selectedId: string | null }
  | { panel: "schedule"; selectedId: string | null }
  | { panel: "watchers"; selectedId: string | null; draft: boolean }
  | { panel: "errors"; selectedId: string | null };

export function idle(): ConsoleNav {
  return { panel: "idle" };
}

export function openPanel(current: ConsoleNav, panel: PanelId): ConsoleNav {
  if (current.panel === panel) {
    if (panel === "logs" && current.selectedId) {
      return { panel: "logs", filter: current.filter, selectedId: null };
    }
    if (panel === "schedule" && current.selectedId) {
      return { panel: "schedule", selectedId: null };
    }
    if (panel === "watchers" && (current.selectedId || current.draft)) {
      return { panel: "watchers", selectedId: null, draft: false };
    }
    if (panel === "errors" && current.selectedId) {
      return { panel: "errors", selectedId: null };
    }
    return idle();
  }
  if (panel === "logs") return { panel: "logs", filter: "all", selectedId: null };
  if (panel === "schedule") return { panel: "schedule", selectedId: null };
  if (panel === "errors") return { panel: "errors", selectedId: null };
  return { panel: "watchers", selectedId: null, draft: false };
}

export function selectInPanel(current: ConsoleNav, id: string | null): ConsoleNav {
  if (current.panel === "idle") return current;
  if (current.panel === "logs") return { ...current, selectedId: id };
  if (current.panel === "schedule") return { ...current, selectedId: id };
  if (current.panel === "errors") return { ...current, selectedId: id };
  return { ...current, selectedId: id, draft: false };
}

export function setLogFilter(current: ConsoleNav, filter: LogFilter): ConsoleNav {
  if (current.panel !== "logs") return current;
  return { ...current, filter, selectedId: null };
}

export function beginWatcherDraft(current: ConsoleNav): ConsoleNav {
  return { panel: "watchers", selectedId: null, draft: true };
}
