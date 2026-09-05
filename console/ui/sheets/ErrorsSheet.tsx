import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { ConsoleNav } from "../../domain/nav";
import { CopyButton } from "../CopyButton";
import { Sheet } from "../Sheet";

type CollectedError = {
  id: string;
  message: string;
  code?: string;
  source?: string;
  clientId?: string;
  jobId?: string;
  url?: string;
  stack?: string;
  createdAt: number;
};

type Props = {
  nav: Extract<ConsoleNav, { panel: "errors" }>;
  onClose: () => void;
  onSelect: (id: string | null) => void;
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

function copyPayload(error: CollectedError): string {
  return [
    error.code || error.source || "error",
    formatTime(error.createdAt),
    error.message,
    error.stack,
    error.url,
    error.jobId ? `job: ${error.jobId}` : null,
    error.clientId ? `client: ${error.clientId}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function ErrorsSheet({ nav, onClose, onSelect }: Props) {
  const [records, setRecords] = useState<CollectedError[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const raw = await api<{ records?: CollectedError[] }>("/v1/collect-error?limit=100");
        if (cancelled) return;
        setRecords(Array.isArray(raw.records) ? raw.records : []);
        setStatus("ready");
        setMessage("");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : String(err));
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const selected = records.find((r) => r.id === nav.selectedId);
  const copyAllText = records.map(copyPayload).join("\n\n---\n\n");

  return (
    <Sheet
      title="Collected errors"
      eyebrow="Redis"
      onClose={onClose}
      actions={
        <CopyButton
          text={copyAllText}
          label="Copy all"
          mode="label"
          disabled={records.length === 0}
        />
      }
    >
      {status === "loading" && <div className="status-line">Loading…</div>}
      {status === "error" && <div className="status-line">Error: {message}</div>}
      {status === "ready" && (
        <div className="status-line">
          {records.length === 0
            ? "Waiting for extension and cloud agent failures."
            : `${records.length} error${records.length === 1 ? "" : "s"}`}
        </div>
      )}

      {selected ? (
        <div className="list">
          <button type="button" className="btn" onClick={() => onSelect(null)}>
            ← Back to list
          </button>
          <div className="row is-selected log-row is-error">
            <div className="row-title">
              <span>{selected.code || selected.source || "error"}</span>
              <span className="row-title-actions">
                <span className="badge is-error">{selected.source || "redis"}</span>
                <CopyButton text={copyPayload(selected)} label="Copy error" />
              </span>
            </div>
            <div className="row-meta">{formatTime(selected.createdAt)}</div>
            <pre className="log-body">{selected.message}</pre>
            {(selected.url || selected.jobId || selected.clientId) && (
              <div className="row-meta">
                {[selected.url, selected.jobId && `job: ${selected.jobId}`, selected.clientId && `client: ${selected.clientId}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {selected.stack && <pre className="log-body is-stack">{selected.stack}</pre>}
          </div>
        </div>
      ) : records.length === 0 && status === "ready" ? (
        <div className="empty">No Redis errors yet.</div>
      ) : (
        <div className="list">
          {records.map((event) => (
            <button
              key={event.id}
              type="button"
              className="row log-row is-error"
              onClick={() => onSelect(event.id)}
            >
              <div className="row-title">
                <span>{event.code || event.source || "error"}</span>
                <span className="badge is-error">{event.source || "redis"}</span>
              </div>
              <div className="row-meta">{formatTime(event.createdAt)}</div>
              <div className="row-body">{event.message.slice(0, 180)}</div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
