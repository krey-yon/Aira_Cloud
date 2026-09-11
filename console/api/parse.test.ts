import { expect, test } from "bun:test";
import { parseCanvasList, parseCanvasPage } from "./parse";

test("parseCanvasPage keeps id/url and defaults title", () => {
  expect(parseCanvasPage(null)).toBeNull();
  expect(parseCanvasPage({ title: "x" })).toBeNull();
  expect(parseCanvasPage({ id: "cv_1", url: "/r/cv_1" })).toMatchObject({
    id: "cv_1",
    title: "Aira answer",
    url: "/r/cv_1",
  });
});

test("parseCanvasList drops malformed rows", () => {
  expect(
    parseCanvasList({
      canvases: [
        { id: "cv_1", title: "one", createdAt: "t", expiresAt: "e", url: "/r/cv_1" },
        { nope: true },
      ],
    }),
  ).toHaveLength(1);
  expect(parseCanvasList({})).toEqual([]);
});
