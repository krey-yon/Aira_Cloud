import type { ConsoleNav, LogFilter, PanelId } from "../domain/nav";
import { useGmail } from "../hooks/useGmail";
import { BrandPill } from "./BrandPill";
import { Dock } from "./Dock";
import { GmailCard } from "./GmailCard";
import { LogsSheet } from "./sheets/LogsSheet";
import { ScheduleSheet } from "./sheets/ScheduleSheet";
import { WatchersSheet } from "./sheets/WatchersSheet";

type Props = {
  nav: ConsoleNav;
  theme: "light" | "dark";
  onOpen: (panel: PanelId) => void;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  onFilter: (filter: LogFilter) => void;
  onDraft: () => void;
  onToggleTheme: () => void;
};

function subtitleFor(nav: ConsoleNav, gmailEmail: string | null): string {
  if (nav.panel === "idle") return gmailEmail ? gmailEmail : "idle";
  if (nav.panel === "logs") return "logs";
  if (nav.panel === "schedule") return "schedule";
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

      {nav.panel === "idle" && (
        <div className="idle-stack">
          <div className="idle-copy idle-copy-inline">
            <div>
              <h2>Aira is listening</h2>
              <p>Open logs · schedule · watchers</p>
            </div>
          </div>
          <GmailCard
            status={gmail.status}
            error={gmail.error}
            busy={gmail.busy}
            onConnect={gmail.connect}
            onDisconnect={gmail.disconnect}
          />
        </div>
      )}

      {nav.panel !== "idle" && (
        <>
          <button type="button" className="backdrop" aria-label="Close panel" onClick={onClose} />
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
            />
          )}
        </>
      )}

      <Dock
        active={active}
        onOpen={onOpen}
        onToggleTheme={onToggleTheme}
        theme={theme}
        gmailConnected={Boolean(gmail.status?.connected)}
        onGmail={gmail.connect}
      />

      <div className="hint glass">⌘⇧L theme · Esc closes</div>
    </main>
  );
}
