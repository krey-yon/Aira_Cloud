/** Shared helpers for extension + cloud widget presentation. */

import { countWords, shouldUseCanvas } from "./canvas";
import type { WidgetAction, WidgetBodyFormat } from "./agent";

export const PLAIN_ANSWER_WORD_CAP = 80;

const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/gi;

export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/^```\w*\n?/, "").replace(/```$/, "").trim(),
    )
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractUrls(text: string): string[] {
  const found = text.match(URL_RE) ?? [];
  const cleaned = found.map((url) => url.replace(/[.,;:!?)]+$/, ""));
  return [...new Set(cleaned)];
}

export function linkLabelFor(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("notion.so") || host.includes("notion.site")) return "Open in Notion";
    if (host.includes("github.com")) return "Open on GitHub";
    if (host.includes("aira.kreyon.in")) return "Open canvas";
    return `Open ${host}`;
  } catch {
    return "Open link";
  }
}

/** Build primary link actions from answer text (Notion, canvas, general URLs). */
export function actionsFromText(text: string, limit = 3): WidgetAction[] {
  return extractUrls(text)
    .slice(0, limit)
    .map((url, index) => ({
      id: `link_${index + 1}`,
      label: linkLabelFor(url),
      kind: "link" as const,
      url,
      style: index === 0 ? ("primary" as const) : ("secondary" as const),
    }));
}

export function pickBodyFormat(
  text: string,
  opts?: { canvas?: boolean; wordCap?: number },
): WidgetBodyFormat {
  if (opts?.canvas || shouldUseCanvas(text)) return "markdown";
  if (countWords(text) <= (opts?.wordCap ?? PLAIN_ANSWER_WORD_CAP)) return "plain";
  return "markdown";
}

export function presentBody(
  text: string,
  format: WidgetBodyFormat,
): string {
  if (format === "plain") return stripMarkdown(text);
  return text.trim();
}
