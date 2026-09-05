import { expect, test } from "bun:test";

import { extractNotionId, notionPageUrl, richTextPlain } from "./notion";

test("extracts a dashed UUID from a Notion URL", () => {
  expect(
    extractNotionId("https://www.notion.so/Inbox-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?pvs=21"),
  ).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
});

test("normalizes a dashed UUID", () => {
  expect(extractNotionId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")).toBe(
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  );
});

test("builds a shareable Notion URL", () => {
  expect(notionPageUrl("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")).toBe(
    "https://notion.so/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
});

test("joins rich text plain content", () => {
  expect(
    richTextPlain([
      { plain_text: "Hello " },
      { text: { content: "world" } },
    ]),
  ).toBe("Hello world");
});
