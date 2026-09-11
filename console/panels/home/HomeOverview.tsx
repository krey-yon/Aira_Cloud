import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatRelativeTime } from "../../lib/relative-time";
import type { PanelId } from "../../shell/nav";
import type { LoadState } from "../../shell/usePolled";
import type { CanvasPageView, ScheduledTaskView } from "../../api/parse";
import { EASE_OUT, NOTE_SPRING, buildCardShadow, HOME_TINTS } from "../../lib/vellum";
import { playSound } from "../../lib/sounds";
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
/** Verbatim from spatial-notes canvas.drag.threshold — constant sensitivity. */
const DRAG_THRESHOLD_PX = 4;
const ALL_CARDS: CardId[] = ["schedulers", "reminders", "canvas", "drafts", "scheduled-mail"];

const CARD_TINT: Record<CardId, keyof typeof HOME_TINTS> = {
  schedulers: "ocean",
  reminders: "gold",
  canvas: "violet",
  drafts: "forest",
  "scheduled-mail": "plum",
};

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

type DragState = {
  sx: number;
  sy: number;
  moved: boolean;
  offset: { x: number; y: number };
  target: CardId | null;
};

/*
 * Status row — visual language ported verbatim from spatial-notes TodoList Row
 * (checkbox metrics, check mark, animated strikethrough). Read-only here:
 * `done` pins the idle visuals; the motion scaffolding stays exact so a
 * future toggle wires straight in.
 */
function StatusRow({
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
  const done = false;
  const accent = "var(--note-accent)";
  return (
    <motion.div
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -2, transition: { duration: 0.14 } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="home-row"
    >
      <span
        aria-hidden
        className="home-status"
        style={{
          backgroundColor: fill ? accent : "transparent",
          boxShadow: fill
            ? `inset 0 0 0 1px ${accent}`
            : "inset 0 0 0 1.25px color-mix(in oklab, currentColor 35%, transparent)",
        }}
      >
        <AnimatePresence>
          {done && (
            <motion.svg
              key="check"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.14, ease: EASE_OUT }}
              viewBox="0 0 12 12"
              fill="none"
              style={{ width: "0.72em", height: "0.72em" }}
            >
              <path
                d="M3 6.3l2 2 4-4.6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
      <div className="home-row-body">
        <div className="row-title">
          <span>{title}</span>
          {action}
        </div>
        {meta && <div className="row-meta">{meta}</div>}
      </div>
      {/* Animated strikethrough overlay */}
      <motion.span
        aria-hidden
        initial={false}
        animate={{ scaleX: done ? 1 : 0 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
        className="home-strike"
        style={{ transform: "translateY(-1px)" }}
      />
    </motion.div>
  );
}

function More({ count }: { count: number }) {
  if (count <= 0) return null;
  return <div className="row-meta">+{count} more</div>;
}

function SkeletonCard({ tintKey }: { tintKey: keyof typeof HOME_TINTS }) {
  const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  const t = HOME_TINTS[tintKey]!;
  return (
    <section
      className="home-card"
      aria-label="Loading"
      style={
        {
          backgroundColor: theme === "light" ? t.bgLight : t.bg,
          "--note-accent": theme === "light" ? t.accentLight : t.accent,
        } as React.CSSProperties
      }
    >
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
  const [drag, setDrag] = useState<DragState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const dragRef = useRef<{ id: CardId; sx: number; sy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    return () => {
      dragRef.current = null;
    };
  }, []);

  const scheduleLoaded = schedule.status !== "loading";
  const canvasesLoaded = canvases.status !== "loading";
  const mailLoaded = !mail.loading;
  const allLoaded = scheduleLoaded && canvasesLoaded && mailLoaded;

  if (!allLoaded) {
    return (
      <div className="home-grid">
        <SkeletonCard tintKey="ocean" />
        <SkeletonCard tintKey="gold" />
        <SkeletonCard tintKey="violet" />
        <SkeletonCard tintKey="forest" />
        <SkeletonCard tintKey="plum" />
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

  function cardUnder(x: number, y: number): CardId | null {
    const el = document.elementFromPoint(x, y)?.closest?.("[data-card-id]");
    const id = el?.getAttribute("data-card-id");
    return id && (ALL_CARDS as string[]).includes(id) ? (id as CardId) : null;
  }

  function onHeadDown(e: React.PointerEvent, id: CardId) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, moved: false };
  }

  function onHeadMove(e: React.PointerEvent) {
    const s = dragRef.current;
    if (!s) return;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    if (!s.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      s.moved = true;
      setDragId(s.id);
      playSound("pickup");
    }
    if (s.moved) {
      setDrag({ sx: s.sx, sy: s.sy, moved: true, offset: { x: dx, y: dy }, target: cardUnder(e.clientX, e.clientY) });
    }
  }

  function onHeadUp(e: React.PointerEvent) {
    const s = dragRef.current;
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!s?.moved) return;
    suppressClick.current = true;
    const target = cardUnder(e.clientX, e.clientY);
    if (target && target !== s.id) {
      const without = order.filter((id) => id !== s.id);
      const at = without.indexOf(target);
      // Drop below the target's midpoint → insert after, else before.
      const rect = document.querySelector(`[data-card-id="${target}"]`)?.getBoundingClientRect();
      const after = rect ? e.clientY > rect.top + rect.height / 2 : false;
      without.splice(after ? at + 1 : at, 0, s.id);
      persist(without);
      playSound("drop");
    }
    setDragId(null);
    setDrag(null);
  }

  function openPanel(panel: PanelId) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    playSound("tapSoft");
    onOpen(panel);
  }

  async function copy(url: string, id: string) {
    playSound("toggle");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // clipboard unavailable — the link itself still opens the page
    }
  }

  // No banner: empty means a clear canvas.
  if (ordered.length === 0) {
    return <div className="home-grid" />;
  }

  const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

  return (
    <div className="home-grid">
      <AnimatePresence initial={false}>
        {ordered.map((id) => {
          const t = HOME_TINTS[CARD_TINT[id]]!;
          const accent = theme === "light" ? t.accentLight : t.accent;
          const dragging = dragId === id;
          const dropTarget = drag?.target === id && !dragging;
          const offset = dragging && drag ? drag.offset : { x: 0, y: 0 };
          const mode = dragging ? "dragging" : dropTarget ? "selected" : "rest";
          return (
            <motion.section
              key={id}
              data-card-id={id}
              layout
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{
                opacity: 1,
                scale: dragging ? 1.035 : 1,
                x: offset.x,
                y: offset.y,
                boxShadow: buildCardShadow(accent, mode),
              }}
              exit={{ opacity: 0, scale: 0.9, y: -6, transition: { duration: 0.18 } }}
              transition={dragging ? { duration: 0.18, ease: EASE_OUT } : NOTE_SPRING}
              whileHover={dragging ? undefined : { y: -1 }}
              style={
                {
                  backgroundColor: theme === "light" ? t.bgLight : t.bg,
                  "--note-accent": accent,
                  zIndex: dragging ? 50 : 10,
                } as React.CSSProperties
              }
              className="home-card"
            >
              <div
                className="home-card-head"
                onPointerDown={(e) => onHeadDown(e, id)}
                onPointerMove={onHeadMove}
                onPointerUp={onHeadUp}
                onPointerCancel={() => {
                  dragRef.current = null;
                  setDragId(null);
                  setDrag(null);
                }}
              >
                <span className="home-card-pill" aria-hidden />
                <button
                  type="button"
                  className="home-card-title"
                  onClick={() => openPanel(cardPanel(id))}
                >
                  {cardTitle(id)}
                </button>
                <span className="home-card-open" aria-hidden>
                  →
                </span>
              </div>
              {renderCardBody(id, { schedule, tasks, due, canvases, pages, mail, copiedId, copy })}
              <div className="home-card-stamp">{renderStamp(id, { tasks, due, pages, mail })}</div>
            </motion.section>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function cardPanel(id: CardId): PanelId {
  if (id === "canvas") return "logs";
  if (id === "drafts" || id === "scheduled-mail") return "mail";
  return "schedule";
}

function cardTitle(id: CardId): string {
  if (id === "schedulers") return "Schedulers";
  if (id === "reminders") return "Reminders · due soon";
  if (id === "canvas") return "Canvas pages";
  if (id === "drafts") return "Drafts";
  return "Scheduled emails";
}

type CardData = {
  schedule: LoadState<ScheduledTaskView[]>;
  tasks: ScheduledTaskView[];
  due: Array<{ task: ScheduledTaskView; ms: number }>;
  canvases: LoadState<CanvasPageView[]>;
  pages: CanvasPageView[];
  mail: { board: MailBoard; error: string | null };
  copiedId: string | null;
  copy: (url: string, id: string) => void;
};

function renderCardBody(id: CardId, d: CardData) {
  if (id === "schedulers") {
    if (d.schedule.status === "error")
      return <div className="status-line">Error: {d.schedule.message}</div>;
    return (
      <div className="list">
        <AnimatePresence initial={false}>
          {d.tasks.slice(0, ROW_CAP).map((task) => (
            <StatusRow
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
        </AnimatePresence>
        <More count={d.tasks.length - ROW_CAP} />
      </div>
    );
  }
  if (id === "reminders") {
    if (d.schedule.status === "error")
      return <div className="status-line">Error: {d.schedule.message}</div>;
    return (
      <div className="list">
        <AnimatePresence initial={false}>
          {d.due.slice(0, ROW_CAP).map(({ task }) => (
            <StatusRow key={task.id} fill title={task.title} meta={formatRelativeTime(task.runAt)} />
          ))}
        </AnimatePresence>
        <More count={d.due.length - ROW_CAP} />
      </div>
    );
  }
  if (id === "canvas") {
    if (d.canvases.status === "error")
      return <div className="status-line">Error: {d.canvases.message}</div>;
    return (
      <div className="list">
        <AnimatePresence initial={false}>
          {d.pages.slice(0, ROW_CAP).map((page) => (
            <StatusRow
              key={page.id}
              title={
                <a href={page.url} target="_blank" rel="noreferrer">
                  {page.title}
                </a>
              }
              meta={`${formatRelativeTime(page.createdAt)} · expires ${formatRelativeTime(page.expiresAt)}`}
              action={
                <button type="button" className="btn" onClick={() => void d.copy(page.url, page.id)}>
                  {d.copiedId === page.id ? "Copied" : "Copy link"}
                </button>
              }
            />
          ))}
        </AnimatePresence>
        <More count={d.pages.length - ROW_CAP} />
      </div>
    );
  }
  if (id === "drafts") {
    if (d.mail.error) return <div className="status-line">Error: {d.mail.error}</div>;
    return (
      <div className="list">
        <AnimatePresence initial={false}>
          {d.mail.board.drafts.slice(0, ROW_CAP).map((draft) => (
            <StatusRow
              key={draft.id}
              title={draft.subject || "(no subject)"}
              meta={`to ${draft.to.join(", ") || "—"}`}
            />
          ))}
        </AnimatePresence>
        <More count={d.mail.board.drafts.length - ROW_CAP} />
      </div>
    );
  }
  if (d.mail.error) return <div className="status-line">Error: {d.mail.error}</div>;
  return (
    <div className="list">
      <AnimatePresence initial={false}>
        {d.mail.board.scheduled.slice(0, ROW_CAP).map((item) => (
          <StatusRow
            key={item.id}
            title={item.subject || "(no subject)"}
            meta={`to ${item.to.join(", ") || "—"}${item.runAt ? ` · sends ${formatRelativeTime(item.runAt)}` : ""}`}
          />
        ))}
      </AnimatePresence>
      <More count={d.mail.board.scheduled.length - ROW_CAP} />
    </div>
  );
}

function renderStamp(
  id: CardId,
  d: { tasks: ScheduledTaskView[]; due: Array<{ task: ScheduledTaskView }>; pages: CanvasPageView[]; mail: { board: MailBoard } },
): string {
  if (id === "schedulers") return `${d.tasks.length} active`;
  if (id === "reminders")
    return d.due.length > 0 ? `next ${formatRelativeTime(d.due[0]!.task.runAt)}` : "none due";
  if (id === "canvas") return `${d.pages.length} live`;
  if (id === "drafts") return `${d.mail.board.drafts.length} unsent`;
  return `${d.mail.board.scheduled.length} queued`;
}
