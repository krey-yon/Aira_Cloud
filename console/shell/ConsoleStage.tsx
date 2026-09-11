import type { ConsoleNav, LogFilter, PanelId } from "./nav";
import { useGmail } from "./useGmail";
import { BrandPill } from "./BrandPill";
import { Dock } from "./Dock";
import { LogoutButton } from "./LogoutButton";
import { ErrorsSheet } from "../panels/errors/ErrorsSheet";
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
  onToggleTheme: () => void;
  onLogout: () => void;
};

function subtitleFor(nav: ConsoleNav, gmailEmail: string | null): string {
  if (nav.panel === "idle") return "console";
  if (nav.panel === "logs") return "agent log";
  if (nav.panel === "schedule") return "schedule";
  if (nav.panel === "errors") return "errors";
  if (nav.panel === "skills") return "skills";
  if (nav.panel === "mail") return gmailEmail ? gmailEmail : "mail";
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
  onToggleTheme,
  onLogout,
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
      <LogoutButton onLogout={onLogout} />

      {nav.panel === "mail" && <MailSheet gmail={gmail} onClose={onClose} />}

      {nav.panel === "logs" && (
        <LogsSheet nav={nav} onClose={onClose} onSelect={onSelect} onFilter={onFilter} />
      )}
      {nav.panel === "schedule" && (
        <ScheduleSheet nav={nav} onClose={onClose} onSelect={onSelect} />
      )}
      {nav.panel === "watchers" && (
        <WatchersSheet nav={nav} onClose={onClose} onSelect={onSelect} onDraft={onDraft} />
      )}
      {nav.panel === "errors" && (
        <ErrorsSheet nav={nav} onClose={onClose} onSelect={onSelect} />
      )}
      {nav.panel === "skills" && (
        <SkillsSheet nav={nav} onClose={onClose} onSelect={onSelect} />
      )}

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
