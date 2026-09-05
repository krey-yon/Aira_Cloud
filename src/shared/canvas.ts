/** Word-cap gate for routing long agent answers to the cloud canvas. */

export const CANVAS_WORD_CAP = 120;

export const WIDGET_PREVIEW_WORDS = 48;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function shouldUseCanvas(text: string, cap = CANVAS_WORD_CAP): boolean {
  return countWords(text) > cap;
}

export function previewWords(text: string, maxWords = WIDGET_PREVIEW_WORDS): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= maxWords) return text.trim();
  return `${parts.slice(0, maxWords).join(" ")}…`;
}
