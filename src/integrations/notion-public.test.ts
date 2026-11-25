import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  analyzePublicNotionPage,
  formatUpdatedAgo,
  getPublicNotionLastUpdated,
  parseNotionPublicInput,
} from "./notion-public";

const PAGE_HEX = "d80756a61955826990990186ae8f9586";
const PAGE_ID = "d80756a6-1955-8269-9099-0186ae8f9586";
const NOW = Date.parse("2026-11-25T12:00:00.000Z");

afterEach(() => {
  mock.restore();
});

describe("parseNotionPublicInput", () => {
  test("parses notion.site slug URL", () => {
    const parsed = parseNotionPublicInput(
      `https://actually-parakeet-221.notion.site/Aesthetic-New-Year-Planner-${PAGE_HEX}`,
    );
    expect(parsed.pageId).toBe(PAGE_ID);
    expect(parsed.spaceDomain).toBe("actually-parakeet-221");
    expect(parsed.sourceUrl).toContain("notion.site");
  });

  test("parses notion.so URL with query p=", () => {
    const parsed = parseNotionPublicInput(
      `https://www.notion.so/workspace/Some-Page?p=${PAGE_HEX}&pm=s`,
    );
    expect(parsed.pageId).toBe(PAGE_ID);
  });

  test("parses raw 32-hex id", () => {
    expect(parseNotionPublicInput(PAGE_HEX).pageId).toBe(PAGE_ID);
  });

  test("rejects input without a page id", () => {
    expect(() => parseNotionPublicInput("https://www.notion.so/")).toThrow(
      /Could not find a Notion page id/,
    );
  });
});

describe("formatUpdatedAgo", () => {
  test("formats minutes hours days months", () => {
    expect(formatUpdatedAgo(NOW - 3 * 60_000, NOW)).toBe("3 min ago");
    expect(formatUpdatedAgo(NOW - 2 * 3_600_000, NOW)).toBe("2 hours ago");
    expect(formatUpdatedAgo(NOW - 5 * 86_400_000, NOW)).toBe("5 days ago");
    expect(formatUpdatedAgo(NOW - 60 * 86_400_000, NOW)).toBe("2 months ago");
  });

  test("returns null for missing input", () => {
    expect(formatUpdatedAgo(null, NOW)).toBeNull();
    expect(formatUpdatedAgo(undefined, NOW)).toBeNull();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("analyzePublicNotionPage", () => {
  test("builds a public dossier with updatedAgo", async () => {
    const lastEdited = NOW - 3 * 3_600_000;
    const created = NOW - 10 * 86_400_000;

    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("getPublicPageData") && method === "POST") {
        return jsonResponse({
          pageId: PAGE_ID,
          spaceName: "Demo Space",
          spaceDomain: "demo-space",
          spaceShortId: "123",
          publicDomainName: "demo-space",
          requireLogin: false,
          publicAccessRole: "reader",
          canRequestAccess: false,
          isDeleted: false,
          isPublicShareLink: true,
          isEditableOrCommentableSite: false,
          requireInterstitial: `https://demo-space.notion.site/Page-${PAGE_HEX}`,
        });
      }

      if (url.includes("loadCachedPageChunkV2") && method === "POST") {
        return jsonResponse({
          recordMap: {
            block: {
              [PAGE_ID]: {
                spaceId: "space-1",
                value: {
                  value: {
                    id: PAGE_ID,
                    type: "page",
                    properties: { title: [["Public Demo"]] },
                    format: { page_icon: "📌" },
                    content: ["child-1"],
                    created_time: created,
                    last_edited_time: lastEdited,
                    alive: true,
                  },
                  role: "reader",
                },
              },
              "child-1": {
                value: {
                  value: {
                    id: "child-1",
                    type: "text",
                    properties: { title: [["Hello"]] },
                  },
                  role: "reader",
                },
              },
              "child-page": {
                value: {
                  value: {
                    id: "child-page",
                    type: "page",
                    properties: { title: [["Nested"]] },
                  },
                  role: "reader",
                },
              },
            },
          },
        });
      }

      return new Response("not found", { status: 404 });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const dossier = await analyzePublicNotionPage({
      url: `https://demo-space.notion.site/Page-${PAGE_HEX}`,
      nowMs: NOW,
      includeOgFallback: false,
    });

    expect(dossier.ok).toBe(true);
    expect(dossier.access.verdict).toBe("public");
    expect(dossier.identity.title).toBe("Public Demo");
    expect(dossier.identity.pageId).toBe(PAGE_ID);
    expect(dossier.content?.updatedAgo).toBe("3 hours ago");
    expect(dossier.content?.lastEditedTime).toBe(new Date(lastEdited).toISOString());
    expect(dossier.content?.childPageCount).toBe(1);
    expect(dossier.content?.outline.some((o) => o.type === "text")).toBe(true);
  });

  test("reports login-required without loading private content", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("getPublicPageData")) {
        return jsonResponse({
          pageId: PAGE_ID,
          requireLogin: true,
          publicAccessRole: "none",
          isDeleted: false,
          isPublicShareLink: false,
          canRequestAccess: true,
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as unknown as typeof fetch;

    const dossier = await analyzePublicNotionPage({
      pageId: PAGE_HEX,
      nowMs: NOW,
      includeOgFallback: false,
    });

    expect(dossier.access.verdict).toBe("login-required");
    expect(dossier.content).toBeNull();
    expect(dossier.warnings.some((w) => /login/i.test(w))).toBe(true);
  });
});

describe("getPublicNotionLastUpdated", () => {
  test("returns relative updated message when public", async () => {
    const lastEdited = NOW - 90 * 60_000;

    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("getPublicPageData")) {
        return jsonResponse({
          pageId: PAGE_ID,
          spaceDomain: "demo",
          publicAccessRole: "reader",
          requireLogin: false,
          isDeleted: false,
          isPublicShareLink: true,
        });
      }
      if (url.includes("loadCachedPageChunkV2")) {
        return jsonResponse({
          recordMap: {
            block: {
              [PAGE_ID]: {
                value: {
                  value: {
                    id: PAGE_ID,
                    type: "page",
                    properties: { title: [["Fresh Page"]] },
                    last_edited_time: lastEdited,
                    created_time: lastEdited - 86_400_000,
                  },
                  role: "reader",
                },
              },
            },
          },
        });
      }
      return new Response("nope", { status: 404 });
    }) as unknown as typeof fetch;

    const result = await getPublicNotionLastUpdated({
      url: `https://www.notion.so/${PAGE_HEX}`,
      nowMs: NOW,
    });

    expect(result.available).toBe(true);
    expect(result.updatedAgo).toBe("2 hours ago");
    expect(result.message).toContain("2 hours ago");
    expect(result.title).toBe("Fresh Page");
  });
});
