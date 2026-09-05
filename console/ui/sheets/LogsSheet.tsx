import type { ConsoleNav, LogFilter } from "../../domain/nav";
import { useLogs } from "../../hooks/useData";
import { Sheet } from "../Sheet";

const FILTERS: { id: LogFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "jobs", label: "Jobs" },
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

export function LogsSheet({ nav, onClose, onSelect, onFilter }: Props) {
  const state = useLogs(true, nav.filter);
  const events = state.status === "ready" ? state.data : [];
  const selected = events.find((e) => e.id === nav.selectedId);

  return (
    <Sheet title="Agent log" onClose={onClose}>
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
          <div className="row is-selected">
            <div className="row-title">
              <span>{selected.title}</span>
              <span className={`badge${selected.level === "error" ? " is-error" : ""}`}>
                {selected.kind}
              </span>
            </div>
            <div className="row-meta">{formatTime(selected.at)}</div>
            <div className="row-body">{selected.body || "(empty)"}</div>
            {(selected.jobId || selected.source) && (
              <div className="row-meta">
                {[selected.jobId, selected.source, selected.clientId].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
      ) : events.length === 0 && state.status === "ready" ? (
        <div className="empty">No agent activity yet. Send a task from the extension.</div>
      ) : (
        <div className="list">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              className="row"
              onClick={() => onSelect(event.id)}
            >
              <div className="row-title">
                <span>{event.title}</span>
                <span className={`badge${event.level === "error" ? " is-error" : ""}`}>
                  {event.kind}
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
