const SCHEDULE_INTENT_RE =
  /\b(remind(?:ers?|ing)?|schedule|later|tomorrow|in\s+\d+\s*(?:minutes?|hours?|days?))\b/i;

export function wantsSchedule(text: string): boolean {
  return SCHEDULE_INTENT_RE.test(text);
}

function asObject(result: unknown): Record<string, unknown> | null {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  if (typeof result !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(result);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export function scheduleToolSucceeded(
  toolCalls: { name: string; result?: unknown }[] | undefined,
): boolean {
  if (!toolCalls) return false;
  for (const call of toolCalls) {
    if (call.name !== "schedule_task") continue;
    const parsed = asObject(call.result);
    if (parsed?.ok === true) return true;
  }
  return false;
}
