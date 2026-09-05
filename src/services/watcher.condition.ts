/** JSON condition helpers for watchers. */

export type ConditionOp =
  | "eq"
  | "neq"
  | "truthy"
  | "falsy"
  | "contains"
  | "gt"
  | "lt";

export type WatchCondition = {
  /** Dot path into JSON, e.g. pageProps.grant.isPaused */
  path: string;
  op: ConditionOp;
  value?: string;
};

export function getByPath(root: unknown, path: string): unknown {
  const parts = path
    .replace(/^\$\.?/, "")
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  let cur: unknown = root;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function evalCondition(root: unknown, condition: WatchCondition): {
  ok: boolean;
  observed: unknown;
} {
  const observed = getByPath(root, condition.path);
  const expected = condition.value;
  switch (condition.op) {
    case "truthy":
      return { ok: Boolean(observed), observed };
    case "falsy":
      return { ok: !observed, observed };
    case "eq":
      return {
        ok: String(observed) === String(expected ?? "") ||
          (expected === "false" && observed === false) ||
          (expected === "true" && observed === true),
        observed,
      };
    case "neq":
      return {
        ok: !(
          String(observed) === String(expected ?? "") ||
          (expected === "false" && observed === false) ||
          (expected === "true" && observed === true)
        ),
        observed,
      };
    case "contains":
      return {
        ok: String(observed ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase()),
        observed,
      };
    case "gt":
      return { ok: Number(observed) > Number(expected), observed };
    case "lt":
      return { ok: Number(observed) < Number(expected), observed };
    default:
      return { ok: false, observed };
  }
}

export function describeCondition(condition: WatchCondition): string {
  const base = `${condition.path} ${condition.op}`;
  if (condition.value == null || condition.value === "") return base;
  return `${base} ${condition.value}`;
}

/** All conditions must pass (AND). */
export function evalAllConditions(
  root: unknown,
  conditions: WatchCondition[],
): { ok: boolean; observed: Record<string, unknown>; summary: string } {
  const observed: Record<string, unknown> = {};
  let ok = true;
  for (const condition of conditions) {
    const result = evalCondition(root, condition);
    observed[condition.path] = result.observed;
    if (!result.ok) ok = false;
  }
  const summary = Object.entries(observed)
    .map(([path, value]) => `${path.split(".").pop()}=${JSON.stringify(value)}`)
    .join(", ");
  return { ok, observed, summary };
}

export function parseConditionsJson(raw: string | null | undefined): WatchCondition[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        if (typeof o.path !== "string" || typeof o.op !== "string") return null;
        return {
          path: o.path,
          op: o.op as ConditionOp,
          value: typeof o.value === "string" ? o.value : undefined,
        } satisfies WatchCondition;
      })
      .filter((c): c is WatchCondition => c != null);
  } catch {
    return [];
  }
}

/**
 * Next.js `_next/data` is `{ pageProps }`.
 * `__NEXT_DATA__` is `{ props: { pageProps } }`.
 * Normalize so conditions can always use `pageProps.*`.
 */
export function normalizeWatchPayload(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const obj = json as Record<string, unknown>;
  if (obj.pageProps) return json;
  const props = obj.props;
  if (props && typeof props === "object" && "pageProps" in (props as object)) {
    return { pageProps: (props as { pageProps: unknown }).pageProps };
  }
  return json;
}
