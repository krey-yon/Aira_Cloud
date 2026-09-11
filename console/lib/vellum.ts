/*
 * Motion + shadow + tint constants ported verbatim from spatial-notes / Vellum (MIT).
 * Copyright (c) 2026 Ayomide Aluko. Values from src/theme.config.ts,
 * src/components/Note.tsx and src/components/TodoList.tsx.
 */

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Spring used for note enter / layout transitions. */
export const NOTE_SPRING = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.7 };

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const NOTE_REST =
  "0 1px 2px rgba(0,0,0,0.20), 0 6px 14px -4px rgba(0,0,0,0.30), 0 16px 36px -12px rgba(0,0,0,0.40)";

export type CardShadowMode = "rest" | "selected" | "dragging";

/** Verbatim from getNoteShadow(): selected doubles as our drop-target ring. */
export function buildCardShadow(accent: string, mode: CardShadowMode): string {
  if (mode === "dragging") {
    return (
      "0 2px 4px rgba(0,0,0,0.25), 0 22px 50px -10px rgba(0,0,0,0.35), " +
      `0 32px 80px -20px ${hexToRgba(accent, 0.4)}`
    );
  }
  if (mode === "selected") {
    return (
      `${NOTE_REST}, 0 18px 40px -12px ${hexToRgba(accent, 0.35)}, ` +
      `0 8px 24px -8px ${hexToRgba(accent, 0.25)}`
    );
  }
  return NOTE_REST;
}

export type HomeTint = {
  bg: string;
  bgLight: string;
  accent: string;
  accentLight: string;
};

/** Verbatim note palette entries from theme.config.ts (5 tints used by home cards). */
export const HOME_TINTS: Record<string, HomeTint> = {
  ocean: { bg: "#10283e", bgLight: "#dff4ff", accent: "#4cc9ff", accentLight: "#0096d6" },
  gold: { bg: "#39351c", bgLight: "#fff5c9", accent: "#f7d44c", accentLight: "#b78500" },
  violet: { bg: "#2a2050", bgLight: "#eee7ff", accent: "#a78bfa", accentLight: "#7652df" },
  forest: { bg: "#143128", bgLight: "#e0f7e9", accent: "#66e3a4", accentLight: "#16965a" },
  plum: { bg: "#31203d", bgLight: "#f6e5ff", accent: "#e78bff", accentLight: "#a73bd0" },
};
