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
      className="sheet-feed"
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
        <div className="feed">
          <button type="button" className="feed-back" onClick={() => onSelect(null)}>
            ← Back
          </button>
          <article className={`feed-detail is-${toneFor(selected)}`}>
            <div className="feed-meta">
              <time dateTime={new Date(selected.at).toISOString()}>{formatTime(selected.at)}</time>
              <span className={`feed-kind is-${toneFor(selected)}`}>{badgeLabel(selected)}</span>
              <CopyButton text={copyPayload(selected)} label="Copy" mode="label" />
            </div>
            <h4 className="feed-title">{selected.title}</h4>
            <pre className="feed-body">{selected.body || "(empty)"}</pre>
            {(selected.jobId || selected.source || selected.clientId) && (
              <p className="feed-refs">
                {[selected.jobId, selected.source, selected.clientId].filter(Boolean).join(" · ")}
              </p>
            )}
          </article>
        </div>
      ) : events.length === 0 && state.status === "ready" ? (
        <div className="empty">No agent activity yet.</div>
      ) : (
        <div className="feed" role="list">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              role="listitem"
              className={`feed-item is-${toneFor(event)}`}
              onClick={() => onSelect(event.id)}
            >
              <div className="feed-meta">
                <time dateTime={new Date(event.at).toISOString()}>{formatTime(event.at)}</time>
                <span className={`feed-kind is-${toneFor(event)}`}>{badgeLabel(event)}</span>
              </div>
              <div className="feed-title">{event.title}</div>
              {event.body ? <div className="feed-excerpt">{event.body}</div> : null}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
