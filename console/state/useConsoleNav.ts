import { useCallback, useEffect, useReducer } from "react";
import {
  beginWatcherDraft,
  idle,
  openPanel,
  selectInPanel,
  setLogFilter,
  type ConsoleNav,
  type LogFilter,
  type PanelId,
} from "../domain/nav";

type NavAction =
  | { type: "open"; panel: PanelId }
  | { type: "close" }
  | { type: "select"; id: string | null }
  | { type: "filter"; filter: LogFilter }
  | { type: "draft" };

function reduceNav(nav: ConsoleNav, action: NavAction): ConsoleNav {
  switch (action.type) {
    case "open":
      return openPanel(nav, action.panel);
    case "close":
      return idle();
    case "select":
      return selectInPanel(nav, action.id);
    case "filter":
      return setLogFilter(nav, action.filter);
    case "draft":
      return beginWatcherDraft(nav);
  }
}

export function useConsoleNav() {
  const [nav, dispatch] = useReducer(reduceNav, idle());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "close" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return {
    nav,
    open: useCallback((panel: PanelId) => dispatch({ type: "open", panel }), []),
    close: useCallback(() => dispatch({ type: "close" }), []),
    select: useCallback((id: string | null) => dispatch({ type: "select", id }), []),
    setFilter: useCallback((filter: LogFilter) => dispatch({ type: "filter", filter }), []),
    startDraft: useCallback(() => dispatch({ type: "draft" }), []),
  };
}
