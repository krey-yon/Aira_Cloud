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
  return scheduleTaskFailureReason(toolCalls) === null;
}

/** Null when a schedule_task call returned ok:true; otherwise a human-readable reason. */
export function scheduleTaskFailureReason(
  toolCalls: { name: string; result?: unknown }[] | undefined,
): string | null {
  if (!toolCalls) return "the schedule_task tool was not called";
  let sawSchedule = false;
  let lastError: string | null = null;
  for (const call of toolCalls) {
    if (call.name !== "schedule_task") continue;
    sawSchedule = true;
    const parsed = asObject(call.result);
    if (parsed?.ok === true) return null;
    const raw =
      parsed && typeof parsed.error === "string" && parsed.error.trim()
        ? parsed.error.trim()
        : typeof call.result === "string" && call.result.trim()
          ? call.result.trim().slice(0, 280)
          : "";
    lastError = raw || "it returned ok: false";
  }
  if (!sawSchedule) return "the schedule_task tool was not called";
  return lastError ?? "it returned ok: false";
}
