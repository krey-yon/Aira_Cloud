import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { ConsoleNav } from "../../domain/nav";
import { formatRelativeTime } from "../../lib/relative-time";
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

function copyPayload(error: CollectedError): string {
  return [
    error.code || error.source || "error",
    new Date(error.createdAt).toISOString(),
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
      className="sheet-feed"
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
      {status === "ready" && records.length > 0 && (
        <div className="status-line">
          {records.length} error{records.length === 1 ? "" : "s"}
        </div>
      )}

      {selected ? (
        <div className="feed">
          <button type="button" className="feed-back" onClick={() => onSelect(null)}>
            ← Back
          </button>
          <article className="feed-detail is-error">
            <div className="feed-meta">
              <time dateTime={new Date(selected.createdAt).toISOString()}>
                {formatRelativeTime(selected.createdAt)}
              </time>
              <span className="feed-kind is-error">{selected.source || "redis"}</span>
              <CopyButton text={copyPayload(selected)} label="Copy" mode="label" />
            </div>
            <h4 className="feed-title">{selected.code || selected.source || "error"}</h4>
            <pre className="feed-body">{selected.message}</pre>
            {(selected.url || selected.jobId || selected.clientId) && (
              <p className="feed-refs">
                {[
                  selected.url,
                  selected.jobId && `job: ${selected.jobId}`,
                  selected.clientId && `client: ${selected.clientId}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {selected.stack ? <pre className="feed-body is-stack">{selected.stack}</pre> : null}
          </article>
        </div>
      ) : records.length === 0 && status === "ready" ? (
        <div className="empty">No collected errors yet.</div>
      ) : (
        <div className="feed" role="list">
          {records.map((event) => (
            <button
              key={event.id}
              type="button"
              role="listitem"
              className="feed-item is-error"
              onClick={() => onSelect(event.id)}
            >
              <div className="feed-meta">
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {formatRelativeTime(event.createdAt)}
                </time>
                <span className="feed-kind is-error">{event.source || "redis"}</span>
              </div>
              <div className="feed-title">{event.code || event.source || "error"}</div>
              <div className="feed-excerpt">{event.message}</div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
