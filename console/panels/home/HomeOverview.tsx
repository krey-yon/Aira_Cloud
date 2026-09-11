import { useState } from "react";
import { formatRelativeTime } from "../../lib/relative-time";
import type { PanelId } from "../../shell/nav";
import type { LoadState } from "../../shell/usePolled";
import type { ScheduledTaskView } from "../../api/parse";
import type { CanvasPageView } from "../../api/parse";
import { useSchedule } from "../schedule/useSchedule";
import { useMailBoard, type MailBoard } from "../mail/useMailBoard";
import { useCanvases } from "./useCanvases";

type Props = {
  onOpen: (panel: PanelId) => void;
};

type CardId = "schedulers" | "reminders" | "canvas" | "drafts" | "scheduled-mail";

const ROW_CAP = 5;
const REMINDER_WINDOW_MS = 24 * 3_600_000;
const ORDER_KEY = "aira:home-order";
const ALL_CARDS: CardId[] = ["schedulers", "reminders", "canvas", "drafts", "scheduled-mail"];

function loadOrder(): CardId[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return ALL_CARDS;
    const ids = (JSON.parse(raw) as unknown[]).filter(
      (id): id is CardId => typeof id === "string" && (ALL_CARDS as string[]).includes(id),
    );
    return [...ids, ...ALL_CARDS.filter((id) => !ids.includes(id))];
  } catch {
    return ALL_CARDS;
  }
}

function CardShell({
  id,
  tint,
  title,
  panel,
  stamp,
  onOpen,
  dragging,
  dropTarget,
  onDragStartCard,
  onDropCard,
  onDragOverCard,
  onDragEndCard,
  children,
}: {
  id: CardId;
  tint: string;
  title: string;
  panel: PanelId;
  stamp: string;
  onOpen: (panel: PanelId) => void;
  dragging: boolean;
  dropTarget: boolean;
  onDragStartCard: (id: CardId) => void;
  onDropCard: (id: CardId) => void;
  onDragOverCard: (id: CardId) => void;
  onDragEndCard: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`home-card ${tint}${dragging ? " is-dragging" : ""}${dropTarget ? " is-drop-target" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverCard(id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropCard(id);
      }}
    >
      <div
        className="home-card-head"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStartCard(id);
        }}
        onDragEnd={onDragEndCard}
      >
        <span className="home-card-pill" aria-hidden />
        <button type="button" className="home-card-title" onClick={() => onOpen(panel)}>
          {title}
        </button>
        <span className="home-card-open" aria-hidden>
          →
        </span>
      </div>
      {children}
      <div className="home-card-stamp">{stamp}</div>
    </section>
  );
}

function Row({
  fill,
  title,
  meta,
  action,
}: {
  fill?: boolean;
  title: React.ReactNode;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="home-row">
      <span className={`home-status${fill ? " is-fill" : ""}`} aria-hidden />
      <div className="home-row-body">
        <div className="row-title">
          <span>{title}</span>
          {action}
        </div>
        {meta && <div className="row-meta">{meta}</div>}
      </div>
    </div>
  );
}

function More({ count }: { count: number }) {
  if (count <= 0) return null;
  return <div className="row-meta">+{count} more</div>;
}

function SkeletonCard({ tint }: { tint: string }) {
  return (
    <section className={`home-card ${tint}`} aria-label="Loading">
      <div className="home-card-head">
        <span className="home-card-pill" aria-hidden />
        <span className="home-skeleton-block" style={{ height: 13, width: "55%" }} />
      </div>
      <div className="list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="home-row">
            <span className="home-skeleton-block" style={{ width: 13, height: 13 }} />
            <div className="home-row-body">
              <div className="home-skeleton-block" style={{ height: 14, width: `${85 - i * 12}%` }} />
              <div
                className="home-skeleton-block"
                style={{ height: 11, width: "45%", marginTop: 6 }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomeOverview({ onOpen }: Props) {
  const schedule = useSchedule(true);
  const canvases = useCanvases(true);
  const mail = useMailBoard(true);

  const [order, setOrder] = useState<CardId[]>(loadOrder);
  const [dragId, setDragId] = useState<CardId | null>(null);
  const [dropId, setDropId] = useState<CardId | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scheduleLoaded = schedule.status !== "loading";
  const canvasesLoaded = canvases.status !== "loading";
  const mailLoaded = !mail.loading;
  const allLoaded = scheduleLoaded && canvasesLoaded && mailLoaded;

  if (!allLoaded) {
    return (
      <div className="home-grid">
        <SkeletonCard tint="home-tint-ocean" />
        <SkeletonCard tint="home-tint-gold" />
        <SkeletonCard tint="home-tint-violet" />
        <SkeletonCard tint="home-tint-forest" />
        <SkeletonCard tint="home-tint-plum" />
      </div>
    );
  }

  const tasks =
    schedule.status === "ready"
      ? schedule.data.filter(
          (t) => t.status === "pending" || t.status === "running" || t.status === "error",
        )
      : [];
  const now = Date.now();
  const due =
    schedule.status === "ready"
      ? schedule.data
          .filter((t) => t.status === "pending" || t.status === "running")
          .map((t) => ({ task: t, ms: Date.parse(t.runAt) }))
          .filter((r) => Number.isFinite(r.ms) && r.ms - now <= REMINDER_WINDOW_MS)
          .sort((a, b) => a.ms - b.ms)
      : [];
  const pages = canvases.status === "ready" ? canvases.data : [];

  const showSchedulers = schedule.status === "error" || tasks.length > 0;
  const showReminders = schedule.status === "error" || due.length > 0;
  const showCanvas = canvases.status === "error" || pages.length > 0;
  const showDrafts = mail.error != null || mail.board.drafts.length > 0;
  const showScheduledMail = mail.error != null || mail.board.scheduled.length > 0;

  const visible = new Set<CardId>(
    [
      showSchedulers && "schedulers",
      showReminders && "reminders",
      showCanvas && "canvas",
      showDrafts && "drafts",
      showScheduledMail && "scheduled-mail",
    ].filter((id): id is CardId => id !== false),
  );
  const ordered = order.filter((id) => visible.has(id));

  function persist(next: CardId[]) {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
    } catch {
      // private mode — order just won't survive reload
    }
  }

  function handleDrop(target: CardId) {
    if (dragId && dragId !== target) {
      const without = order.filter((id) => id !== dragId);
      const at = without.indexOf(target);
      without.splice(at, 0, dragId);
      persist(without);
    }
    setDragId(null);
    setDropId(null);
  }

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // clipboard unavailable — the link itself still opens the page
    }
  }

  if (ordered.length === 0) {
    return (
      <div className="home-grid">
        <div className="glass home-welcome">
          <h2>All clear</h2>
          <p>Nothing scheduled, no drafts, no canvas pages. Ask Aira to schedule something.</p>
        </div>
      </div>
    );
  }

  const shell = {
    onOpen,
    dragging: false,
    dropTarget: false,
    onDragStartCard: setDragId,
    onDropCard: handleDrop,
    onDragOverCard: setDropId,
    onDragEndCard: () => {
      setDragId(null);
      setDropId(null);
    },
  };

  return (
    <div className="home-grid">
      {ordered.map((id) => {
        const dragProps = {
          ...shell,
          dragging: dragId === id,
          dropTarget: dropId === id && dragId !== id,
        };
        if (id === "schedulers") {
          return (
            <CardShell
              key={id}
              id={id}
              tint="home-tint-ocean"
              title="Schedulers"
              panel="schedule"
              stamp={`${tasks.length} active`}
              {...dragProps}
            >
              {renderSchedule(schedule, tasks)}
            </CardShell>
          );
        }
        if (id === "reminders") {
          return (
            <CardShell
              key={id}
              id={id}
              tint="home-tint-gold"
              title="Reminders · due soon"
              panel="schedule"
              stamp={due.length > 0 ? `next ${formatRelativeTime(due[0]!.task.runAt)}` : "none due"}
              {...dragProps}
            >
              {renderReminders(schedule, due)}
            </CardShell>
          );
        }
        if (id === "canvas") {
          return (
            <CardShell
              key={id}
              id={id}
              tint="home-tint-violet"
              title="Canvas pages"
              panel="logs"
              stamp={`${pages.length} live`}
              {...dragProps}
            >
              {renderCanvas(canvases, pages, copiedId, copy)}
            </CardShell>
          );
        }
        if (id === "drafts") {
          return (
            <CardShell
              key={id}
              id={id}
              tint="home-tint-forest"
              title="Drafts"
              panel="mail"
              stamp={`${mail.board.drafts.length} unsent`}
              {...dragProps}
            >
              {renderDrafts(mail.board, mail.error)}
            </CardShell>
          );
        }
        return (
          <CardShell
            key={id}
            id={id}
            tint="home-tint-plum"
            title="Scheduled emails"
            panel="mail"
            stamp={`${mail.board.scheduled.length} queued`}
            {...dragProps}
          >
            {renderScheduledMail(mail.board, mail.error)}
          </CardShell>
        );
      })}
    </div>
  );
}

function renderSchedule(
  schedule: LoadState<ScheduledTaskView[]>,
  tasks: ScheduledTaskView[],
) {
  if (schedule.status === "error") return <div className="status-line">Error: {schedule.message}</div>;
  return (
    <div className="list">
      {tasks.slice(0, ROW_CAP).map((task) => (
        <Row
          key={task.id}
          fill={task.status === "error"}
          title={
            <>
              {task.title} <span className={`badge is-${task.status}`}>{task.status}</span>
            </>
          }
          meta={`runs ${formatRelativeTime(task.runAt)}${task.status === "error" && task.error ? ` · ${task.error}` : ""}`}
        />
      ))}
      <More count={tasks.length - ROW_CAP} />
    </div>
  );
}

function renderReminders(
  schedule: LoadState<ScheduledTaskView[]>,
  due: Array<{ task: ScheduledTaskView; ms: number }>,
) {
  if (schedule.status === "error") return <div className="status-line">Error: {schedule.message}</div>;
  return (
    <div className="list">
      {due.slice(0, ROW_CAP).map(({ task }) => (
        <Row
          key={task.id}
          fill
          title={task.title}
          meta={formatRelativeTime(task.runAt)}
        />
      ))}
      <More count={due.length - ROW_CAP} />
    </div>
  );
}

function renderCanvas(
  canvases: LoadState<CanvasPageView[]>,
  pages: CanvasPageView[],
  copiedId: string | null,
  copy: (url: string, id: string) => void,
) {
  if (canvases.status === "error") return <div className="status-line">Error: {canvases.message}</div>;
  return (
    <div className="list">
      {pages.slice(0, ROW_CAP).map((page) => (
        <Row
          key={page.id}
          title={
            <a href={page.url} target="_blank" rel="noreferrer">
              {page.title}
            </a>
          }
          meta={`${formatRelativeTime(page.createdAt)} · expires ${formatRelativeTime(page.expiresAt)}`}
          action={
            <button type="button" className="btn" onClick={() => void copy(page.url, page.id)}>
              {copiedId === page.id ? "Copied" : "Copy link"}
            </button>
          }
        />
      ))}
      <More count={pages.length - ROW_CAP} />
    </div>
  );
}

function renderDrafts(board: MailBoard, error: string | null) {
  if (error) return <div className="status-line">Error: {error}</div>;
  return (
    <div className="list">
      {board.drafts.slice(0, ROW_CAP).map((draft) => (
        <Row
          key={draft.id}
          title={draft.subject || "(no subject)"}
          meta={`to ${draft.to.join(", ") || "—"}`}
        />
      ))}
      <More count={board.drafts.length - ROW_CAP} />
    </div>
  );
}

function renderScheduledMail(board: MailBoard, error: string | null) {
  if (error) return <div className="status-line">Error: {error}</div>;
  return (
    <div className="list">
      {board.scheduled.slice(0, ROW_CAP).map((mail) => (
        <Row
          key={mail.id}
          title={mail.subject || "(no subject)"}
          meta={`to ${mail.to.join(", ") || "—"}${mail.runAt ? ` · sends ${formatRelativeTime(mail.runAt)}` : ""}`}
        />
      ))}
      <More count={board.scheduled.length - ROW_CAP} />
    </div>
  );
}
