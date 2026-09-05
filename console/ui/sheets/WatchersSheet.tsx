import { useState } from "react";
import { api } from "../../api/client";
import { parseWatcher } from "../../api/parse";
import type { ConsoleNav } from "../../domain/nav";
import { useWatchers } from "../../hooks/useData";
import { Sheet } from "../Sheet";

type Props = {
  nav: Extract<ConsoleNav, { panel: "watchers" }>;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  onDraft: () => void;
};

export function WatchersSheet({ nav, onClose, onSelect, onDraft }: Props) {
  const state = useWatchers(true);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const watchers = state.status === "ready" ? state.data : [];
  const selected = watchers.find((w) => w.id === nav.selectedId);

  async function create() {
    setBusy(true);
    try {
      const raw = await api<unknown>("/v1/watchers", {
        method: "POST",
        body: JSON.stringify({ title, prompt }),
      });
      const watcher = parseWatcher((raw as { watcher?: unknown }).watcher);
      setTitle("");
      setPrompt("");
      if (watcher) onSelect(watcher.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "active" | "paused") {
    setBusy(true);
    try {
      await api(`/v1/watchers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await api(`/v1/watchers/${id}`, { method: "DELETE" });
      onSelect(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Watchers" onClose={onClose}>
      {!nav.draft && !selected && (
        <div className="form-actions" style={{ marginBottom: "0.75rem" }}>
          <button type="button" className="btn btn-primary" onClick={onDraft}>
            New watcher
          </button>
        </div>
      )}

      {(nav.draft) && (
        <div className="form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should Aira watch for?"
          />
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => onSelect(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !title.trim() || !prompt.trim()}
              onClick={() => void create()}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {state.status === "loading" && <div className="status-line">Loading…</div>}
      {state.status === "error" && <div className="status-line">Error: {state.message}</div>}

      {selected && !nav.draft ? (
        <div className="list">
          <button type="button" className="btn" onClick={() => onSelect(null)}>
            ← Back to list
          </button>
          <div className="row is-selected">
            <div className="row-title">
              <span>{selected.title}</span>
              <span className={`badge is-${selected.status}`}>{selected.status}</span>
            </div>
            <div className="row-body">{selected.prompt}</div>
            {selected.lastNudge && <div className="row-body">{selected.lastNudge}</div>}
            <div className="row-actions">
              {selected.status === "active" ? (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void setStatus(selected.id, "paused")}
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void setStatus(selected.id, "active")}
                >
                  Resume
                </button>
              )}
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void remove(selected.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : !nav.draft && watchers.length === 0 && state.status === "ready" ? (
        <div className="empty">No watchers yet. Add one to track a condition.</div>
      ) : !nav.draft ? (
        <div className="list">
          {watchers.map((watcher) => (
            <button
              key={watcher.id}
              type="button"
              className="row"
              onClick={() => onSelect(watcher.id)}
            >
              <div className="row-title">
                <span>{watcher.title}</span>
                <span className={`badge is-${watcher.status}`}>{watcher.status}</span>
              </div>
              <div className="row-body">{watcher.prompt.slice(0, 140)}</div>
            </button>
          ))}
        </div>
      ) : null}
    </Sheet>
  );
}
