import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatRelativeTime } from "../../lib/relative-time";
import type { PanelId } from "../../shell/nav";
import type { LoadState } from "../../shell/usePolled";
import type { CanvasPageView, ScheduledTaskView } from "../../api/parse";
import { EASE_OUT, NOTE_SPRING, buildCardShadow, HOME_TINTS } from "../../lib/vellum";
import { playSound, type SoundName } from "../../lib/sounds";
import { useSchedule } from "../schedule/useSchedule";
import { useMailBoard, type MailBoard } from "../mail/useMailBoard";
import { useCanvases } from "./useCanvases";

type Props = {
  onOpen: (panel: PanelId) => void;
};

type CardId = "schedulers" | "reminders" | "canvas" | "drafts" | "scheduled-mail";

const ROW_CAP = 5;
const REMINDER_WINDOW_MS = 24 * 3_600_000;
const POSITIONS_KEY = "aira:home-positions";
/** Verbatim from spatial-notes canvas.drag.threshold. */
const DRAG_THRESHOLD_PX = 4;
const ALL_CARDS: CardId[] = ["schedulers", "reminders", "canvas", "drafts", "scheduled-mail"];

/** First-run scatter slots, as fractions of canvas size. */
const DEFAULT_POSITIONS: Record<CardId, { x: number; y: number }> = {
  schedulers: { x: 0.05, y: 0.06 },
  reminders: { x: 0.38, y: 0.02 },
  canvas: { x: 0.7, y: 0.08 },
  drafts: { x: 0.12, y: 0.55 },
  "scheduled-mail": { x: 0.5, y: 0.58 },
};

const CARD_TINT: Record<CardId, keyof typeof HOME_TINTS> = {
  schedulers: "ocean",
  reminders: "gold",
  canvas: "violet",
  drafts: "forest",
  "scheduled-mail": "plum",
};

type Positions = Partial<Record<CardId, { x: number; y: number }>>;

/** Audio must never break dragging — Vellum calls this in click handlers, ours runs mid-drag. */
function safePlay(name: SoundName) {
  try {
    playSound(name);
  } catch {
    // audio unavailable — interaction continues silently
  }
}

function loadPositions(): Positions {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Positions = {};
    for (const id of ALL_CARDS) {
      const p = parsed[id] as { x?: unknown; y?: unknown } | undefined;
      if (p && typeof p.x === "number" && typeof p.y === "number") {
        out[id] = {
          x: Math.min(0.99, Math.max(0, p.x)),
          y: Math.min(0.99, Math.max(0, p.y)),
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

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

function SkeletonCard({ tintKey, pos }: { tintKey: keyof typeof HOME_TINTS; pos: { x: number; y: number } }) {
  const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  const t = HOME_TINTS[tintKey]!;
  return (
    <div className="home-note" style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}>
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
    </div>
  );
}

type DragSession = {
  id: CardId;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  moved: boolean;
  rafId: number | null;
};

export function HomeOverview({ onOpen }: Props) {
  const schedule = useSchedule(true);
  const canvases = useCanvases(true);
  const mail = useMailBoard(true);

  const [positions, setPositions] = useState<Positions>(loadPositions);
  const [dragId, setDragId] = useState<CardId | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrappers = useRef(new Map<CardId, HTMLDivElement>());
  const dragRef = useRef<DragSession | null>(null);
  const suppressClick = useRef(false);

  // Cleanup any in-flight RAF if the home unmounts mid-drag (verbatim Vellum guard).
  useEffect(() => {
    return () => {
      if (dragRef.current?.rafId) cancelAnimationFrame(dragRef.current.rafId);
      dragRef.current = null;
    };
  }, []);

  const scheduleLoaded = schedule.status !== "loading";
  const canvasesLoaded = canvases.status !== "loading";
  const mailLoaded = !mail.loading;
  const allLoaded = scheduleLoaded && canvasesLoaded && mailLoaded;

  if (!allLoaded) {
    return (
      <div className="home-canvas">
        {(Object.keys(DEFAULT_POSITIONS) as CardId[]).map((id) => (
          <SkeletonCard key={id} tintKey={CARD_TINT[id]} pos={DEFAULT_POSITIONS[id]!} />
        ))}
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

  const visible = ALL_CARDS.filter((id) => {
    if (id === "schedulers") return showSchedulers;
    if (id === "reminders") return showReminders;
    if (id === "canvas") return showCanvas;
    if (id === "drafts") return showDrafts;
    return showScheduledMail;
  });

  function persist(next: Positions) {
    setPositions(next);
    try {
      localStorage.setItem(POSITIONS_KEY, JSON.stringify(next));
    } catch {
      // private mode — positions just won't survive reload
    }
  }

  function narrow(): boolean {
    return window.innerWidth <= 800;
  }

  // ─── Drag (verbatim Vellum pointer flow on the outer wrapper) ──────────
  function applyDragTransform() {
    const s = dragRef.current;
    if (!s) return;
    s.rafId = null;
    const el = wrappers.current.get(s.id);
    if (el) el.style.transform = `translate3d(${s.dx}px, ${s.dy}px, 0)`;
  }

  function onHeadDown(e: React.PointerEvent, id: CardId) {
    if (narrow()) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const pos = positions[id] ?? DEFAULT_POSITIONS[id]!;
    const rect = canvasRef.current?.getBoundingClientRect();
    dragRef.current = {
      id,
      sx: e.clientX,
      sy: e.clientY,
      ox: pos.x * (rect?.width ?? 1),
      oy: pos.y * (rect?.height ?? 1),
      dx: 0,
      dy: 0,
      moved: false,
      rafId: null,
    };
  }

  function onHeadMove(e: React.PointerEvent) {
    const s = dragRef.current;
    if (!s) return;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    if (!s.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      s.moved = true;
      setDragId(s.id);
      safePlay("pickup");
    }
    if (s.moved) {
      s.dx = dx;
      s.dy = dy;
      if (s.rafId === null) s.rafId = requestAnimationFrame(applyDragTransform);
    }
  }

  function onHeadUp(e: React.PointerEvent) {
    const s = dragRef.current;
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!s) return;
    if (s.rafId !== null) cancelAnimationFrame(s.rafId);
    const el = wrappers.current.get(s.id);
    if (el) el.style.transform = "";
    if (!s.moved) return;
    suppressClick.current = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      const x = Math.min(0.99, Math.max(0, (s.ox + s.dx) / rect.width));
      const y = Math.min(0.99, Math.max(0, (s.oy + s.dy) / rect.height));
      persist({ ...positions, [s.id]: { x, y } });
      safePlay("drop");
    }
    setDragId(null);
  }

  function openPanel(panel: PanelId) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    safePlay("tapSoft");
    onOpen(panel);
  }

  async function copy(url: string, id: string) {
    safePlay("toggle");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // clipboard unavailable — the link itself still opens the page
    }
  }

  // No banner: empty means a clear canvas.
  if (visible.length === 0) {
    return <div className="home-canvas" />;
  }

  const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

  return (
    <div className="home-canvas" ref={canvasRef}>
      <AnimatePresence initial={false}>
        {visible.map((id) => {
          const t = HOME_TINTS[CARD_TINT[id]]!;
          const accent = theme === "light" ? t.accentLight : t.accent;
          const dragging = dragId === id;
          const pos = positions[id] ?? DEFAULT_POSITIONS[id]!;
          return (
            <div
              key={id}
              data-card-id={id}
              ref={(el) => {
                if (el) wrappers.current.set(id, el);
                else wrappers.current.delete(id);
              }}
              className="home-note"
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
            >
              <motion.section
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{
                  opacity: 1,
                  scale: dragging ? 1.035 : 1,
                  boxShadow: buildCardShadow(accent, dragging ? "dragging" : "rest"),
                }}
                exit={{ opacity: 0, scale: 0.9, y: -6, transition: { duration: 0.18 } }}
                transition={dragging ? { duration: 0.18, ease: EASE_OUT } : NOTE_SPRING}
                whileHover={dragging ? undefined : { y: -1 }}
                style={
                  {
                    backgroundColor: theme === "light" ? t.bgLight : t.bg,
                    "--note-accent": accent,
                    zIndex: dragging ? 50 : 10,
                    willChange: dragging ? "transform" : "auto",
                  } as React.CSSProperties
                }
                className="home-card"
                aria-label={cardTitle(id)}
              >
                <div
                  className="home-card-head"
                  onPointerDown={(e) => onHeadDown(e, id)}
                  onPointerMove={onHeadMove}
                  onPointerUp={onHeadUp}
                  onPointerCancel={() => {
                    const s = dragRef.current;
                    if (s?.rafId) cancelAnimationFrame(s.rafId);
                    dragRef.current = null;
                    const ell = wrappers.current.get(id);
                    if (ell) ell.style.transform = "";
                    setDragId(null);
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
            </div>
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
