export const KOLKATA_OFFSET = "+05:30";

export const RETRY_AFTER_MS = 5 * 60_000;

const HAS_OFFSET = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseReleaseAt(iso: string): number {
  const trimmed = iso.trim();
  if (!trimmed) throw new Error("releaseAt is required");
  let candidate = trimmed;
  if (DATE_ONLY.test(candidate)) {
    candidate = `${candidate}T00:00:00${KOLKATA_OFFSET}`;
  } else if (!HAS_OFFSET.test(candidate)) {
    candidate = `${candidate}${KOLKATA_OFFSET}`;
  }
  const ms = Date.parse(candidate);
  if (Number.isNaN(ms)) throw new Error("releaseAt must be a valid ISO 8601 datetime");
  return ms;
}

export function advanceWeeklySchedule(
  nextReleaseAt: number,
  recurrenceDays: number,
  now: number,
): number {
  const step = recurrenceDays * 86_400_000;
  if (step <= 0) throw new Error("recurrenceDays must be positive");
  let next = nextReleaseAt + step;
  while (next <= now) next += step;
  return next;
}

export function applyFireSuccess(
  tracker: { episode: number; nextReleaseAt: number; recurrenceDays: number },
  now: number,
): {
  episode: number;
  nextReleaseAt: number;
  lastNotifiedAt: number;
  lastError: undefined;
  lastAttemptAt: number;
  status: "active";
} {
  return {
    episode: tracker.episode + 1,
    nextReleaseAt: advanceWeeklySchedule(
      tracker.nextReleaseAt,
      tracker.recurrenceDays,
      now,
    ),
    lastNotifiedAt: now,
    lastError: undefined,
    lastAttemptAt: now,
    status: "active",
  };
}

export function unitLabel(kind: "anime" | "manhwa"): "Episode" | "Chapter" {
  return kind === "manhwa" ? "Chapter" : "Episode";
}
