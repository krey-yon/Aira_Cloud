import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { config } from "../config";
import type { AppDeps } from "../http/deps";
import { createRoutes } from "../http/routes";
import { resetStoreForTests } from "./kv.store";

function storeReq(method: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (config.cloudToken) headers.Authorization = `Bearer ${config.cloudToken}`;
  return new Request("http://localhost/v1/store", {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const dir = mkdtempSync(join(tmpdir(), "aira-store-http-"));
process.env.STORE_DB = join(dir, "store.sqlite");

const routes = createRoutes({} as AppDeps);
const storeRoutes = routes["/v1/store"] as {
  GET: (req: Request) => Promise<Response>;
  PUT: (req: Request) => Promise<Response>;
  DELETE: (req: Request) => Promise<Response>;
};

beforeEach(() => {
  resetStoreForTests();
});

afterEach(() => {
  resetStoreForTests();
});

test("GET PUT DELETE /v1/store write and list the replica", async () => {
  const empty = await storeRoutes.GET(storeReq("GET"));
  expect(empty.status).toBe(200);
  expect(await empty.json()).toEqual({ store: {}, epoch: 0 });

  const put = await storeRoutes.PUT(storeReq("PUT", { key: "email-sig", value: "Best,\nVikas" }));
  expect(put.status).toBe(200);
  const putBody = (await put.json()) as { entry: { key: string; value: string } };
  expect(putBody.entry).toMatchObject({ key: "email-sig", value: "Best,\nVikas" });

  const listed = await storeRoutes.GET(storeReq("GET"));
  const dump = (await listed.json()) as { store: Record<string, { value: string }>; epoch: number };
  expect(dump.epoch).toBe(1);
  expect(dump.store["email-sig"]?.value).toBe("Best,\nVikas");

  const bad = await storeRoutes.PUT(storeReq("PUT", { key: "", value: "x" }));
  expect(bad.status).toBe(400);

  const del = await storeRoutes.DELETE(storeReq("DELETE", { key: "email-sig" }));
  expect(del.status).toBe(200);
  expect(await del.json()).toEqual({ ok: true });

  const after = await storeRoutes.GET(storeReq("GET"));
  expect(await after.json()).toEqual({ store: {}, epoch: 2 });

  const missing = await storeRoutes.DELETE(storeReq("DELETE", { key: "email-sig" }));
  expect(missing.status).toBe(200);
  const still = await storeRoutes.GET(storeReq("GET"));
  expect(await still.json()).toEqual({ store: {}, epoch: 2 });

  rmSync(dir, { recursive: true, force: true });
});
