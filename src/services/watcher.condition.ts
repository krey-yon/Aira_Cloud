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
  /** Dot path into JSON, e.g. status or data.user.active */
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
      return { ok: String(observed) === String(expected ?? ""), observed };
    case "neq":
      return { ok: String(observed) !== String(expected ?? ""), observed };
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
