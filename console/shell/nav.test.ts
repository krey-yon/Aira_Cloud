import { expect, test } from "bun:test";
import {
  beginWatcherDraft,
  idle,
  openPanel,
  selectInPanel,
  setLogFilter,
  setWatchersTab,
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

test("setLogFilter, errors panel, and watcher draft stay on typed union", () => {
  const filtered = setLogFilter(openPanel(idle(), "logs"), "errors");
  expect(filtered).toEqual({ panel: "logs", filter: "errors", selectedId: null });

  const errors = openPanel(idle(), "errors");
  expect(errors).toEqual({ panel: "errors", selectedId: null });
  expect(selectInPanel(errors, "err_1")).toEqual({ panel: "errors", selectedId: "err_1" });

  const draft = beginWatcherDraft(idle());
  expect(draft).toEqual({ panel: "watchers", tab: "poll", selectedId: null, draft: true });
  expect(selectInPanel(draft, null)).toEqual({
    panel: "watchers",
    tab: "poll",
    selectedId: null,
    draft: false,
  });
});

test("watchers tab switches clear selection and draft", () => {
  const watchers = openPanel(idle(), "watchers");
  expect(watchers).toEqual({
    panel: "watchers",
    tab: "poll",
    selectedId: null,
    draft: false,
  });
  const anime = setWatchersTab(selectInPanel(watchers, "w_1"), "anime");
  expect(anime).toEqual({
    panel: "watchers",
    tab: "anime",
    selectedId: null,
    draft: false,
  });
  const draft = beginWatcherDraft(anime);
  expect(draft).toEqual({
    panel: "watchers",
    tab: "anime",
    selectedId: null,
    draft: true,
  });
});

test("mail panel is { panel: mail } only and toggles like other panels", () => {
  const mail = openPanel(idle(), "mail");
  expect(mail).toEqual({ panel: "mail" });
  expect(selectInPanel(mail, "msg_1")).toEqual({ panel: "mail" });
  expect(openPanel(mail, "mail")).toEqual(idle());
  expect(openPanel(mail, "logs")).toEqual({
    panel: "logs",
    filter: "all",
    selectedId: null,
  });
});

test("store panel toggles like mail (no selection state)", () => {
  const store = openPanel(idle(), "store");
  expect(store).toEqual({ panel: "store" });
  expect(selectInPanel(store, "anything")).toEqual({ panel: "store" });
  expect(openPanel(store, "store")).toEqual(idle());
});

test("skills panel selects and clears like other detail panels", () => {
  const skills = openPanel(idle(), "skills");
  expect(skills).toEqual({ panel: "skills", selectedId: null });
  const selected = selectInPanel(skills, "notion");
  expect(selected).toEqual({ panel: "skills", selectedId: "notion" });
  expect(openPanel(selected, "skills")).toEqual({ panel: "skills", selectedId: null });
});
