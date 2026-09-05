import type { LogEvent } from "../../api/parse";
import type { ConsoleNav, LogFilter } from "../../domain/nav";
import { useLogs } from "../../hooks/useData";
import { CopyButton } from "../CopyButton";
import { Sheet } from "../Sheet";

const FILTERS: { id: LogFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "jobs", label: "AI" },
  { id: "tools", label: "Tools" },
  { id: "errors", label: "Errors" },
  { id: "server", label: "Server" },
];

type Props = {
  nav: Extract<ConsoleNav, { panel: "logs" }>;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  onFilter: (filter: LogFilter) => void;
};

function formatTime(at: number) {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toneFor(event: LogEvent): string {
  if (event.level === "error" || event.kind === "error") return "error";
  if (event.source === "thinking") return "thinking";
  if (event.kind === "tool") return "tool";
  if (event.kind === "job") return "job";
  return "server";
}

function badgeLabel(event: LogEvent): string {
  if (event.source === "thinking") return "thinking";
  if (event.kind === "tool") return "tool";
  if (event.kind === "error") return "error";
  if (event.kind === "job") return "ai";
  return event.kind;
}

function copyPayload(event: LogEvent): string {
  return [
    event.title,
    formatTime(event.at),
    event.body,
    event.jobId ? `job: ${event.jobId}` : null,
    event.source ? `source: ${event.source}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function LogsSheet({ nav, onClose, onSelect, onFilter }: Props) {
  const state = useLogs(true, nav.filter);
  const events = state.status === "ready" ? state.data : [];
  const selected = events.find((e) => e.id === nav.selectedId);
  const copyAllText = events.map(copyPayload).join("\n\n---\n\n");

  return (
    <Sheet
      title="Agent log"
      eyebrow="Live"
      onClose={onClose}
      actions={
        <CopyButton
          text={copyAllText}
          label="Copy all"
          mode="label"
          disabled={events.length === 0}
        />
      }
    >
      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip${nav.filter === f.id ? " is-active" : ""}`}
            onClick={() => onFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {state.status === "loading" && <div className="status-line">Loading…</div>}
      {state.status === "error" && <div className="status-line">Error: {state.message}</div>}

      {selected ? (
        <div className="list">
          <button type="button" className="btn" onClick={() => onSelect(null)}>
            ← Back to list
          </button>
          <div className={`row is-selected log-row is-${toneFor(selected)}`}>
            <div className="row-title">
              <span>{selected.title}</span>
              <span className="row-title-actions">
                <span className={`badge is-${toneFor(selected)}`}>{badgeLabel(selected)}</span>
                <CopyButton text={copyPayload(selected)} label="Copy log" />
              </span>
            </div>
            <div className="row-meta">{formatTime(selected.at)}</div>
            <pre className="log-body">{selected.body || "(empty)"}</pre>
            {(selected.jobId || selected.source) && (
              <div className="row-meta">
                {[selected.jobId, selected.source, selected.clientId].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
      ) : events.length === 0 && state.status === "ready" ? (
        <div className="empty">No agent activity yet.</div>
      ) : (
        <div className="list">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              className={`row log-row is-${toneFor(event)}`}
              onClick={() => onSelect(event.id)}
            >
              <div className="row-title">
                <span>{event.title}</span>
                <span className="row-title-actions">
                  <span className={`badge is-${toneFor(event)}`}>{badgeLabel(event)}</span>
                  {(event.level === "error" || event.kind === "error") && (
                    <CopyButton text={copyPayload(event)} label="Copy error" />
                  )}
                </span>
              </div>
              <div className="row-meta">{formatTime(event.at)}</div>
              <div className="row-body">{event.body.slice(0, 160)}</div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
