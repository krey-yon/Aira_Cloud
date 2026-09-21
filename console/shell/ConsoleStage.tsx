import type { ConsoleNav, LogFilter, PanelId, WatchersTab } from "./nav";
import { useGmail } from "./useGmail";
import { BrandPill } from "./BrandPill";
import { Dock } from "./Dock";
import { ErrorsSheet } from "../panels/errors/ErrorsSheet";
import { HomeOverview } from "../panels/home/HomeOverview";
import { StoreSheet } from "../panels/store/StoreSheet";
import { LogsSheet } from "../panels/logs/LogsSheet";
import { MailSheet } from "../panels/mail/MailSheet";
import { ScheduleSheet } from "../panels/schedule/ScheduleSheet";
import { SkillsSheet } from "../panels/skills/SkillsSheet";
import { WatchersSheet } from "../panels/watchers/WatchersSheet";

type Props = {
  nav: ConsoleNav;
  theme: "light" | "dark";
  onOpen: (panel: PanelId) => void;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  onFilter: (filter: LogFilter) => void;
  onDraft: () => void;
  onWatchersTab: (tab: WatchersTab) => void;
  onToggleTheme: () => void;
};

function subtitleFor(nav: ConsoleNav, gmailEmail: string | null): string {
  if (nav.panel === "idle") return "console";
  if (nav.panel === "logs") return "agent log";
  if (nav.panel === "schedule") return "schedule";
  if (nav.panel === "errors") return "errors";
  if (nav.panel === "skills") return "skills";
  if (nav.panel === "mail") return gmailEmail ? gmailEmail : "mail";
  if (nav.panel === "store") return "store";
  if (nav.tab === "anime") {
    return nav.draft ? "watchers · anime · draft" : "watchers · anime";
  }
  return nav.draft ? "watchers · draft" : "watchers";
}

export function ConsoleStage({
  nav,
  theme,
  onOpen,
  onClose,
  onSelect,
  onFilter,
  onDraft,
  onWatchersTab,
  onToggleTheme,
}: Props) {
  const active = nav.panel === "idle" ? null : nav.panel;
  const gmail = useGmail(true);

  return (
    <main className="stage canvas-aurora">
      <h1 className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
        Aira Cloud console
      </h1>
      <div className="canvas-vignette" aria-hidden />
      <div className="noise-overlay" aria-hidden />

      <BrandPill subtitle={subtitleFor(nav, gmail.status?.email ?? null)} />

      {nav.panel === "idle" && <HomeOverview onOpen={onOpen} />}

      {nav.panel === "mail" && <MailSheet gmail={gmail} onClose={onClose} />}

      {nav.panel === "logs" && (
        <LogsSheet nav={nav} onClose={onClose} onSelect={onSelect} onFilter={onFilter} />
      )}
      {nav.panel === "schedule" && (
        <ScheduleSheet nav={nav} onClose={onClose} onSelect={onSelect} />
      )}
      {nav.panel === "watchers" && (
        <WatchersSheet
          nav={nav}
          onClose={onClose}
          onSelect={onSelect}
          onDraft={onDraft}
          onTab={onWatchersTab}
        />
      )}
      {nav.panel === "errors" && (
        <ErrorsSheet nav={nav} onClose={onClose} onSelect={onSelect} />
      )}
      {nav.panel === "skills" && (
        <SkillsSheet nav={nav} onClose={onClose} onSelect={onSelect} />
      )}
      {nav.panel === "store" && <StoreSheet onClose={onClose} />}

      <Dock
        active={active}
        onOpen={onOpen}
        onToggleTheme={onToggleTheme}
        theme={theme}
        gmailConnected={Boolean(gmail.status?.connected)}
      />

      <div className="hint glass">⌘⇧L theme · Esc closes</div>
    </main>
  );
}
