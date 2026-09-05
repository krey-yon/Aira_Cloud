/** One-unit relative labels: "in 3 min" / "2 hours ago". Logs keep absolute clocks. */
export function formatRelativeTime(
  input: string | number | Date,
  nowMs = Date.now(),
): string {
  const ms = toMs(input);
  if (ms == null) return "unknown";

  const delta = ms - nowMs;
  const abs = Math.abs(delta);
  if (abs < 1000) return delta >= 0 ? "in a moment" : "just now";

  const fixed = formatUnit(abs);
  return delta >= 0 ? `in ${fixed}` : `${fixed} ago`;
}

function toMs(input: string | number | Date): number | null {
  if (input instanceof Date) {
    const t = input.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }
  const t = Date.parse(input);
  return Number.isFinite(t) ? t : null;
}

function formatUnit(absMs: number): string {
  const sec = Math.round(absMs / 1000);
  if (sec < 60) return `${Math.max(1, sec)} sec`;

  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;

  const hour = Math.round(min / 60);
  if (hour < 48) return hour === 1 ? "1 hour" : `${hour} hours`;

  const day = Math.max(1, Math.round(hour / 24));
  return day === 1 ? "1 day" : `${day} days`;
}
