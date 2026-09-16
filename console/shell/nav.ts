export type PanelId = "logs" | "schedule" | "watchers" | "errors" | "mail" | "skills" | "kv";

export type LogFilter = "all" | "jobs" | "tools" | "errors" | "server";

export type WatchersTab = "poll" | "anime";

export type ConsoleNav =
  | { panel: "idle" }
  | { panel: "logs"; filter: LogFilter; selectedId: string | null }
  | { panel: "schedule"; selectedId: string | null }
  | { panel: "watchers"; tab: WatchersTab; selectedId: string | null; draft: boolean }
  | { panel: "errors"; selectedId: string | null }
  | { panel: "mail" }
  | { panel: "kv" }
  | { panel: "skills"; selectedId: string | null };

export function idle(): ConsoleNav {
  return { panel: "idle" };
}

export function openPanel(current: ConsoleNav, panel: PanelId): ConsoleNav {
  if (current.panel === panel) {
    if (current.panel === "logs" && current.selectedId) {
      return { panel: "logs", filter: current.filter, selectedId: null };
    }
    if (current.panel === "schedule" && current.selectedId) {
      return { panel: "schedule", selectedId: null };
    }
    if (current.panel === "watchers" && (current.selectedId || current.draft)) {
      return { panel: "watchers", tab: current.tab, selectedId: null, draft: false };
    }
    if (current.panel === "errors" && current.selectedId) {
      return { panel: "errors", selectedId: null };
    }
    if (current.panel === "skills" && current.selectedId) {
      return { panel: "skills", selectedId: null };
    }
    return idle();
  }
  if (panel === "logs") return { panel: "logs", filter: "all", selectedId: null };
  if (panel === "schedule") return { panel: "schedule", selectedId: null };
  if (panel === "errors") return { panel: "errors", selectedId: null };
  if (panel === "mail") return { panel: "mail" };
  if (panel === "kv") return { panel: "kv" };
  if (panel === "skills") return { panel: "skills", selectedId: null };
  return { panel: "watchers", tab: "poll", selectedId: null, draft: false };
}

export function selectInPanel(current: ConsoleNav, id: string | null): ConsoleNav {
  if (current.panel === "idle" || current.panel === "mail" || current.panel === "kv") return current;
  if (current.panel === "logs") return { ...current, selectedId: id };
  if (current.panel === "schedule") return { ...current, selectedId: id };
  if (current.panel === "errors") return { ...current, selectedId: id };
  if (current.panel === "skills") return { ...current, selectedId: id };
  return { ...current, selectedId: id, draft: false };
}

export function setWatchersTab(current: ConsoleNav, tab: WatchersTab): ConsoleNav {
  if (current.panel !== "watchers") {
    return { panel: "watchers", tab, selectedId: null, draft: false };
  }
  if (current.tab === tab) return current;
  return { panel: "watchers", tab, selectedId: null, draft: false };
}

export function setLogFilter(current: ConsoleNav, filter: LogFilter): ConsoleNav {
  if (current.panel !== "logs") return current;
  return { ...current, filter, selectedId: null };
}

export function beginWatcherDraft(current: ConsoleNav): ConsoleNav {
  const tab = current.panel === "watchers" ? current.tab : "poll";
  return { panel: "watchers", tab, selectedId: null, draft: true };
}
