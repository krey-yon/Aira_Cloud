import { expect, test } from "bun:test";
import { config } from "../config";
import { authorize, extractBearer, json, readJson, requireAuth } from "./auth";

test("json sets CORS headers", () => {
  const res = json({ ok: true }, 201);
  expect(res.status).toBe(201);
  expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
});

test("extractBearer reads Authorization header", () => {
  const req = new Request("http://localhost/v1/ask", {
    headers: { Authorization: "Bearer secret-token" },
  });
  expect(extractBearer(req)).toBe("secret-token");
});

test("extractBearer falls back to query token", () => {
  const req = new Request("http://localhost/v1/ask?token=query-token");
  expect(extractBearer(req)).toBe("query-token");
});

test("readJson returns 400 response on bad body", async () => {
  const req = new Request("http://localhost/v1/ask", {
    method: "POST",
    body: "not-json",
  });
  const parsed = await readJson(req);
  expect(parsed.ok).toBe(false);
  if (parsed.ok) throw new Error("unreachable");
  expect(parsed.response.status).toBe(400);
});

test("requireAuth rejects wrong bearer when cloud token is configured", () => {
  const req = new Request("http://localhost/v1/ask", {
    headers: { Authorization: "Bearer definitely-wrong-token" },
  });
  const denied = requireAuth(req);
  if (authorize(undefined)) {
    expect(denied).toBeNull();
  } else {
    expect(denied?.status).toBe(401);
  }
});

test("requireAuth accepts a matching bearer", () => {
  if (!config.cloudToken) return;
  const req = new Request("http://localhost/v1/ask", {
    headers: { Authorization: `Bearer ${config.cloudToken}` },
  });
  expect(requireAuth(req)).toBeNull();
});
