import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { parseWatcher, type WatcherView } from "../../api/parse";
import type { ConsoleNav } from "../../domain/nav";
import { useWatchers } from "../../hooks/useData";
import { formatRelativeTime } from "../../lib/relative-time";
import { Sheet } from "../Sheet";

type Props = {
  nav: Extract<ConsoleNav, { panel: "watchers" }>;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  onDraft: () => void;
};

type QueueEvent = {
  id: string;
  title: string;
  body: string;
  status: string;
  emailSent: boolean;
  widgetSent: boolean;
  createdAt: number;
};

function formatChecked(at?: number) {
  if (!at) return "not checked yet";
  return formatRelativeTime(at);
}

function formatInterval(minutes?: number) {
  if (!minutes) return null;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "every 1h" : `every ${hours}h`;
  }
  return `every ${minutes}m`;
}

function statusLine(watcher: WatcherView) {
  if (watcher.lastError) return `Error: ${watcher.lastError}`;
  if (watcher.lastValue) return `Last: ${watcher.lastValue}`;
  return "Waiting for first check…";
}

export function WatchersSheet({ nav, onClose, onSelect, onDraft }: Props) {
  const state = useWatchers(true);
  const [title, setTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [conditionPath, setConditionPath] = useState("active");
  const [conditionOp, setConditionOp] = useState("truthy");
  const [conditionValue, setConditionValue] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("5");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<QueueEvent[]>([]);
  const [presence, setPresence] = useState<string>("checking…");
  const watchers = state.status === "ready" ? state.data : [];
  const selected = watchers.find((w) => w.id === nav.selectedId);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [q, p] = await Promise.all([
          api<{ events?: QueueEvent[] }>("/v1/notify-queue?limit=30"),
          api<{ anyOnline?: boolean }>("/v1/presence"),
        ]);
        if (cancelled) return;
        setQueue(Array.isArray(q.events) ? q.events : []);
        setPresence(p.anyOnline ? "Extension online" : "Extension offline — alerts held");
      } catch {
        if (!cancelled) setPresence("Presence unknown");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  async function create() {
    setBusy(true);
    try {
      const raw = await api<{ watcher?: unknown }>("/v1/watchers", {
        method: "POST",
        body: JSON.stringify({
          title,
          resourceUrl,
          conditionPath,
          conditionOp,
          conditionValue: conditionValue || undefined,
          intervalMinutes: Number(intervalMinutes) || 5,
          prompt: prompt || undefined,
        }),
      });
      const watcher = parseWatcher(raw.watcher);
      setTitle("");
      setResourceUrl("");
      setConditionPath("active");
      setConditionOp("truthy");
      setConditionValue("");
      setIntervalMinutes("5");
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
      <div className="status-line">{presence}</div>

      {!nav.draft && !selected && (
        <div className="form-actions" style={{ marginBottom: "0.75rem" }}>
          <button type="button" className="btn btn-primary" onClick={onDraft}>
            New watcher
          </button>
        </div>
      )}

      {nav.draft && (
        <div className="form">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <input
            value={resourceUrl}
            onChange={(e) => setResourceUrl(e.target.value)}
            placeholder="GET URL (JSON)"
          />
          <input
            value={conditionPath}
            onChange={(e) => setConditionPath(e.target.value)}
            placeholder="JSON path (e.g. active or data.status)"
          />
          <div className="form-actions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select value={conditionOp} onChange={(e) => setConditionOp(e.target.value)}>
              <option value="truthy">truthy</option>
              <option value="falsy">falsy</option>
              <option value="eq">eq</option>
              <option value="neq">neq</option>
              <option value="contains">contains</option>
              <option value="gt">gt</option>
              <option value="lt">lt</option>
            </select>
            <input
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              placeholder="Value (for eq/…)"
            />
          </div>
          <input
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(e.target.value)}
            placeholder="Check every N minutes"
          />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Optional note for the alert body"
          />
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => onSelect(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !title.trim() || !resourceUrl.trim() || !conditionPath.trim()}
              onClick={() => void create()}
            >
              Save watcher
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
            <div className="row-body">{selected.resourceUrl || selected.prompt}</div>
            <div className="row is-selected" style={{ marginTop: 8 }}>
              <div className="row-title">
                <span>Last status</span>
              </div>
              <div className="row-body">{statusLine(selected)}</div>
              <div className="row-meta">
                {[
                  `checked ${formatChecked(selected.lastCheckedAt)}`,
                  selected.nextCheckAt
                    ? `next ${formatChecked(selected.nextCheckAt)}`
                    : null,
                  formatInterval(selected.intervalMinutes),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="row-meta">
              {[
                selected.conditionsJson && selected.conditionsJson !== "[]"
                  ? selected.conditionsJson
                  : selected.conditionPath &&
                    `${selected.conditionPath} ${selected.conditionOp || ""}${
                      selected.conditionValue ? ` ${selected.conditionValue}` : ""
                    }`,
                selected.lastNudge,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <div className="row-actions">
              {selected.status === "active" ? (
                <button type="button" className="btn" disabled={busy} onClick={() => void setStatus(selected.id, "paused")}>
                  Pause
                </button>
              ) : (
                <button type="button" className="btn" disabled={busy} onClick={() => void setStatus(selected.id, "active")}>
                  Resume / re-arm
                </button>
              )}
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void remove(selected.id)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : !nav.draft && watchers.length === 0 && state.status === "ready" ? (
        <div className="empty">No watchers yet. Add a GET URL + condition.</div>
      ) : !nav.draft ? (
        <div className="list">
          {watchers.map((watcher: WatcherView) => (
            <button key={watcher.id} type="button" className="row" onClick={() => onSelect(watcher.id)}>
              <div className="row-title">
                <span>{watcher.title}</span>
                <span className={`badge is-${watcher.status}`}>{watcher.status}</span>
              </div>
              <div className="row-body">{statusLine(watcher)}</div>
              <div className="row-meta">
                {[
                  `checked ${formatChecked(watcher.lastCheckedAt)}`,
                  formatInterval(watcher.intervalMinutes),
                  (watcher.resourceUrl || watcher.prompt || "").slice(0, 80),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {!nav.draft && (
        <div className="list" style={{ marginTop: "1rem" }}>
          <div className="row-title" style={{ padding: "0 0 8px" }}>
            <span>Notification queue</span>
          </div>
          {queue.length === 0 ? (
            <div className="empty">No queued alerts yet.</div>
          ) : (
            queue.map((event) => (
              <div key={event.id} className="row">
                <div className="row-title">
                  <span>{event.title}</span>
                  <span className={`badge is-${event.status}`}>{event.status}</span>
                </div>
                <div className="row-meta">
                  {formatRelativeTime(event.createdAt)} · email {event.emailSent ? "✓" : "—"} · widget{" "}
                  {event.widgetSent ? "✓" : "—"}
                </div>
                <div className="row-body">{event.body.slice(0, 160)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </Sheet>
  );
}
