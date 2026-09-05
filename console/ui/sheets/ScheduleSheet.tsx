import { useState } from "react";
import { api } from "../../api/client";
import type { ConsoleNav } from "../../domain/nav";
import { useSchedule } from "../../hooks/useData";
import { Sheet } from "../Sheet";

type Props = {
  nav: Extract<ConsoleNav, { panel: "schedule" }>;
  onClose: () => void;
  onSelect: (id: string | null) => void;
};

export function ScheduleSheet({ nav, onClose, onSelect }: Props) {
  const state = useSchedule(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const tasks = state.status === "ready" ? state.data : [];
  const selected = tasks.find((t) => t.id === nav.selectedId);

  async function cancel(id: string) {
    setBusyId(id);
    try {
      await api(`/v1/schedule/${id}`, { method: "DELETE" });
      onSelect(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet title="Scheduled tasks" onClose={onClose}>
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
              <span className={`badge is-${selected.status}`}>{selected.status}</span>
            </div>
            <div className="row-meta">runs {selected.runAt}</div>
            <div className="row-body">{selected.prompt}</div>
            {selected.result && <div className="row-body">{selected.result}</div>}
            {selected.error && <div className="row-body">{selected.error}</div>}
            {selected.status === "pending" && (
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busyId === selected.id}
                  onClick={() => void cancel(selected.id)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      ) : tasks.length === 0 && state.status === "ready" ? (
        <div className="empty">No scheduled tasks. Ask Aira to schedule something.</div>
      ) : (
        <div className="list">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className="row"
              onClick={() => onSelect(task.id)}
            >
              <div className="row-title">
                <span>{task.title}</span>
                <span className={`badge is-${task.status}`}>{task.status}</span>
              </div>
              <div className="row-meta">{task.runAt}</div>
              <div className="row-body">{task.prompt.slice(0, 140)}</div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
