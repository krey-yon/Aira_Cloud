import { describe, expect, test } from "bun:test";
import { evalCondition, getByPath } from "./watcher.condition";

describe("watcher conditions", () => {
  test("reads nested paths", () => {
    expect(getByPath({ data: { active: true } }, "data.active")).toBe(true);
  });

  test("truthy / eq", () => {
    expect(evalCondition({ active: true }, { path: "active", op: "truthy" }).ok).toBe(true);
    expect(evalCondition({ status: "open" }, { path: "status", op: "eq", value: "open" }).ok).toBe(true);
    expect(evalCondition({ status: "closed" }, { path: "status", op: "eq", value: "open" }).ok).toBe(false);
  });
});
