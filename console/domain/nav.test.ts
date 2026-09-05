import { expect, test } from "bun:test";
import {
  beginWatcherDraft,
  idle,
  openPanel,
  selectInPanel,
  setLogFilter,
} from "./nav";

test("openPanel toggles idle ↔ panel and clears selection on second tap", () => {
  const logs = openPanel(idle(), "logs");
  expect(logs).toEqual({ panel: "logs", filter: "all", selectedId: null });

  const selected = selectInPanel(logs, "log_1");
  expect(selected).toEqual({ panel: "logs", filter: "all", selectedId: "log_1" });

  const cleared = openPanel(selected, "logs");
  expect(cleared).toEqual({ panel: "logs", filter: "all", selectedId: null });

  expect(openPanel(cleared, "logs")).toEqual(idle());
});

test("setLogFilter and watcher draft stay on typed union", () => {
  const filtered = setLogFilter(openPanel(idle(), "logs"), "errors");
  expect(filtered).toEqual({ panel: "logs", filter: "errors", selectedId: null });

  const draft = beginWatcherDraft(idle());
  expect(draft).toEqual({ panel: "watchers", selectedId: null, draft: true });
  expect(selectInPanel(draft, null)).toEqual({
    panel: "watchers",
    selectedId: null,
    draft: false,
  });
});
