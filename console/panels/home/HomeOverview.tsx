import { useState } from "react";
import { formatRelativeTime } from "../../lib/relative-time";
import type { PanelId } from "../../shell/nav";
import { useSchedule } from "../schedule/useSchedule";
import { useMailBoard } from "../mail/useMailBoard";
import { useCanvases } from "./useCanvases";

type Props = {
  onOpen: (panel: PanelId) => void;
};

const ROW_CAP = 5;
const REMINDER_WINDOW_MS = 24 * 3_600_000;

function Card({
  title,
  panel,
  onOpen,
  children,
}: {
  title: string;
  panel: PanelId;
  onOpen: (panel: PanelId) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="glass home-card">
      <button type="button" className="home-card-head" onClick={() => onOpen(panel)}>
        <span>{title}</span>
        <span aria-hidden>→</span>
      </button>
      {children}
    </section>
  );
}

function More({ count }: { count: number }) {
  if (count <= 0) return null;
  return <div className="row-meta">+{count} more</div>;
}

function SchedulersCard({ onOpen }: { onOpen: (panel: PanelId) => void }) {
  const state = useSchedule(true);
  const tasks =
    state.status === "ready"
      ? state.data.filter((t) => t.status === "pending" || t.status === "running" || t.status === "error")
      : [];
  return (
    <Card title="Schedulers" panel="schedule" onOpen={onOpen}>
      {state.status === "loading" && <div className="status-line">Loading…</div>}
      {state.status === "error" && <div className="status-line">Error: {state.message}</div>}
      {state.status === "ready" && tasks.length === 0 && (
        <div className="empty">No active schedulers.</div>
      )}
      <div className="list">
        {tasks.slice(0, ROW_CAP).map((task) => (
          <div key={task.id} className="row">
            <div className="row-title">
              <span>{task.title}</span>
              <span className={`badge is-${task.status}`}>{task.status}</span>
            </div>
            <div className="row-meta">runs {formatRelativeTime(task.runAt)}</div>
            {task.status === "error" && task.error && (
              <div className="row-body">{task.error}</div>
            )}
          </div>
        ))}
      </div>
      <More count={tasks.length - ROW_CAP} />
    </Card>
  );
}

function RemindersCard({ onOpen }: { onOpen: (panel: PanelId) => void }) {
  const state = useSchedule(true);
  const now = Date.now();
  const due =
    state.status === "ready"
      ? state.data
          .filter((t) => t.status === "pending" || t.status === "running")
          .map((t) => ({ task: t, ms: Date.parse(t.runAt) }))
          .filter((r) => Number.isFinite(r.ms) && r.ms - now <= REMINDER_WINDOW_MS)
          .sort((a, b) => a.ms - b.ms)
      : [];
  return (
    <Card title="Reminders · due soon" panel="schedule" onOpen={onOpen}>
      {state.status === "loading" && <div className="status-line">Loading…</div>}
      {state.status === "error" && <div className="status-line">Error: {state.message}</div>}
      {state.status === "ready" && due.length === 0 && (
        <div className="empty">Nothing due in the next 24 hours.</div>
      )}
      <div className="list">
        {due.slice(0, ROW_CAP).map(({ task }) => (
          <div key={task.id} className="row">
            <div className="row-title">
              <span>{task.title}</span>
              <span className={`badge is-${task.status}`}>{formatRelativeTime(task.runAt)}</span>
            </div>
          </div>
        ))}
      </div>
      <More count={due.length - ROW_CAP} />
    </Card>
  );
}

function CanvasCard({ onOpen }: { onOpen: (panel: PanelId) => void }) {
  const state = useCanvases(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pages = state.status === "ready" ? state.data : [];

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // clipboard unavailable — the link itself still opens the page
    }
  }

  return (
    <Card title="Canvas pages" panel="logs" onOpen={onOpen}>
      {state.status === "loading" && <div className="status-line">Loading…</div>}
      {state.status === "error" && <div className="status-line">Error: {state.message}</div>}
      {state.status === "ready" && pages.length === 0 && (
        <div className="empty">Long answers will appear here.</div>
      )}
      <div className="list">
        {pages.slice(0, ROW_CAP).map((page) => (
          <div key={page.id} className="row">
            <div className="row-title">
              <a href={page.url} target="_blank" rel="noreferrer">
                {page.title}
              </a>
              <button
                type="button"
                className="btn"
                onClick={() => void copy(page.url, page.id)}
              >
                {copiedId === page.id ? "Copied" : "Copy link"}
              </button>
            </div>
            <div className="row-meta">
              {formatRelativeTime(page.createdAt)} · expires {formatRelativeTime(page.expiresAt)}
            </div>
          </div>
        ))}
      </div>
      <More count={pages.length - ROW_CAP} />
    </Card>
  );
}

function DraftsCard({ onOpen }: { onOpen: (panel: PanelId) => void }) {
  const { board, loading, error } = useMailBoard(true);
  return (
    <Card title="Drafts" panel="mail" onOpen={onOpen}>
      {loading && <div className="status-line">Loading…</div>}
      {error && <div className="status-line">Error: {error}</div>}
      {!loading && !error && board.drafts.length === 0 && (
        <div className="empty">No unsent drafts.</div>
      )}
      <div className="list">
        {board.drafts.slice(0, ROW_CAP).map((draft) => (
          <div key={draft.id} className="row">
            <div className="row-title">
              <span>{draft.subject || "(no subject)"}</span>
            </div>
            <div className="row-meta">to {draft.to.join(", ") || "—"}</div>
          </div>
        ))}
      </div>
      <More count={board.drafts.length - ROW_CAP} />
    </Card>
  );
}

function ScheduledMailCard({ onOpen }: { onOpen: (panel: PanelId) => void }) {
  const { board, loading, error } = useMailBoard(true);
  return (
    <Card title="Scheduled emails" panel="mail" onOpen={onOpen}>
      {loading && <div className="status-line">Loading…</div>}
      {error && <div className="status-line">Error: {error}</div>}
      {!loading && !error && board.scheduled.length === 0 && (
        <div className="empty">No scheduled emails.</div>
      )}
      <div className="list">
        {board.scheduled.slice(0, ROW_CAP).map((mail) => (
          <div key={mail.id} className="row">
            <div className="row-title">
              <span>{mail.subject || "(no subject)"}</span>
            </div>
            <div className="row-meta">
              to {mail.to.join(", ") || "—"}
              {mail.runAt ? ` · sends ${formatRelativeTime(mail.runAt)}` : ""}
            </div>
          </div>
        ))}
      </div>
      <More count={board.scheduled.length - ROW_CAP} />
    </Card>
  );
}

export function HomeOverview({ onOpen }: Props) {
  return (
    <div className="home-grid">
      <SchedulersCard onOpen={onOpen} />
      <RemindersCard onOpen={onOpen} />
      <CanvasCard onOpen={onOpen} />
      <DraftsCard onOpen={onOpen} />
      <ScheduledMailCard onOpen={onOpen} />
    </div>
  );
}
