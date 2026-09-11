import type { ReactNode } from "react";
import type { PanelId } from "./nav";

type Props = {
  active: PanelId | null;
  onOpen: (panel: PanelId) => void;
  onToggleTheme: () => void;
  theme: "light" | "dark";
  gmailConnected?: boolean;
};

function IconButton({
  label,
  active,
  onClick,
  pip,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  pip?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`dock-btn${active ? " is-active" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
      {pip ? <span className="dock-pip" aria-hidden /> : null}
    </button>
  );
}

export function Dock({
  active,
  onOpen,
  onToggleTheme,
  theme,
  gmailConnected,
}: Props) {
  return (
    <div className="dock">
      <div className="glass toolbar-shell">
        <IconButton label="Agent log" active={active === "logs"} onClick={() => onOpen("logs")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M3 3.5h8M3 7h8M3 10.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </IconButton>
        <IconButton
          label="Scheduled tasks"
          active={active === "schedule"}
          onClick={() => onOpen("schedule")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 4v3.2l2 1.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </IconButton>
        <IconButton
          label="Watchers"
          active={active === "watchers"}
          onClick={() => onOpen("watchers")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M1.8 7s2-3.5 5.2-3.5S12.2 7 12.2 7s-2 3.5-5.2 3.5S1.8 7 1.8 7z"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <circle cx="7" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </IconButton>
        <IconButton
          label="Collected errors"
          active={active === "errors"}
          onClick={() => onOpen("errors")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M7 1.8 12.2 12H1.8L7 1.8Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M7 5.4v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7" cy="10.2" r="0.7" fill="currentColor" />
          </svg>
        </IconButton>
        <IconButton
          label="Skills"
          active={active === "skills"}
          onClick={() => onOpen("skills")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M3 3.5h8v2.2H3V3.5zm0 4.8h5.5V10H3V8.3z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <circle cx="11" cy="9.2" r="1.4" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </IconButton>
        <IconButton
          label={active === "mail" ? "Close mail" : "Open mail"}
          active={active === "mail"}
          pip={gmailConnected}
          onClick={() => onOpen("mail")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M2.2 3.5h9.6v7H2.2v-7z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M2.4 3.8L7 7.4l4.6-3.6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <span className="dock-divider" />
        <IconButton
          label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M7 1.5v1.6M7 10.9v1.6M2.6 7H1M13 7h-1.6M3.9 3.9L2.8 2.8M11.2 11.2l-1.1-1.1M3.9 10.1l-1.1 1.1M11.2 2.8l-1.1 1.1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M11.6 8.5A4.7 4.7 0 015.5 2.4 5.2 5.2 0 1011.6 8.5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </IconButton>
      </div>
    </div>
  );
}
