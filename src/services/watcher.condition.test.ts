import { describe, expect, test } from "bun:test";
import {
  evalAllConditions,
  evalCondition,
  getByPath,
  normalizeWatchPayload,
} from "./watcher.condition";

describe("watcher conditions", () => {
  test("reads nested paths", () => {
    expect(getByPath({ data: { active: true } }, "data.active")).toBe(true);
  });

  test("truthy / eq booleans", () => {
    expect(evalCondition({ active: true }, { path: "active", op: "truthy" }).ok).toBe(true);
    expect(evalCondition({ status: "open" }, { path: "status", op: "eq", value: "open" }).ok).toBe(true);
    expect(evalCondition({ isPaused: false }, { path: "isPaused", op: "eq", value: "false" }).ok).toBe(true);
    expect(evalCondition({ isPaused: true }, { path: "isPaused", op: "eq", value: "false" }).ok).toBe(false);
  });

  test("AND conditions for grant open", () => {
    const payload = normalizeWatchPayload({
      pageProps: { grant: { isPaused: true, isArchived: false } },
    });
    const waiting = evalAllConditions(payload, [
      { path: "pageProps.grant.isPaused", op: "eq", value: "false" },
      { path: "pageProps.grant.isArchived", op: "eq", value: "false" },
    ]);
    expect(waiting.ok).toBe(false);
    expect(waiting.summary).toContain("isPaused=true");
    expect(waiting.summary).toContain("isArchived=false");

    const open = evalAllConditions(
      { pageProps: { grant: { isPaused: false, isArchived: false } } },
      [
        { path: "pageProps.grant.isPaused", op: "eq", value: "false" },
        { path: "pageProps.grant.isArchived", op: "eq", value: "false" },
      ],
    );
    expect(open.ok).toBe(true);
  });

  test("normalizes __NEXT_DATA__ shape", () => {
    const normalized = normalizeWatchPayload({
      props: { pageProps: { grant: { isPaused: false } } },
    }) as { pageProps: { grant: { isPaused: boolean } } };
    expect(normalized.pageProps.grant.isPaused).toBe(false);
  });
});
