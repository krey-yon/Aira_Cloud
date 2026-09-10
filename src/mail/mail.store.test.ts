import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { unlinkSync } from "node:fs";
import { buildRawMime } from "../gmail/gmail.client";
import { MailStore, resetMailStoreForTests } from "./mail.store";
import { fillTemplate, scoreOutboundImportance } from "./mail.types";

const testDb = `${process.cwd()}/data/mail.test.sqlite`;

describe("gmail mime", () => {
  test("builds base64url raw message", () => {
    const raw = buildRawMime({
      to: ["a@example.com"],
      subject: "Hello",
      body: "Hi there",
    });
    expect(raw.includes("+")).toBe(false);
    expect(raw.includes("/")).toBe(false);
    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    expect(decoded).toContain("To: a@example.com");
    expect(decoded).toContain("Subject: Hello");
    expect(decoded).toContain("Hi there");
  });
});

describe("mail store", () => {
  beforeEach(() => {
    try {
      unlinkSync(testDb);
    } catch {}
    resetMailStoreForTests();
    process.env.MAIL_DB = testDb;
  });

  afterEach(() => {
    resetMailStoreForTests();
    try {
      unlinkSync(testDb);
    } catch {}
  });

  test("template fill and draft from template", () => {
    const store = new MailStore(testDb);
    store.upsertTemplate({
      id: "tpl_demo",
      name: "Demo",
      subjectTemplate: "Hi {{name}}",
      bodyMarkdown: "Hello {{name}} at {{company}}",
      variables: ["name", "company"],
    });
    expect(fillTemplate("Hi {{name}}", { name: "Alex" })).toBe("Hi Alex");
    const draft = store.draftFromTemplate({
      templateId: "tpl_demo",
      accountEmail: "me@kreyon.in",
      to: ["alex@example.com"],
      vars: { name: "Alex", company: "Acme" },
    });
    expect(draft.subject).toBe("Hi Alex");
    expect(draft.body).toContain("Acme");
    expect(draft.templateId).toBe("tpl_demo");
    expect(draft.importance?.score).toBeGreaterThan(0);
  });

  test("list caps recent-like draft status", () => {
    const store = new MailStore(testDb);
    for (let i = 0; i < 3; i++) {
      store.upsertDraft({
        accountEmail: "me@kreyon.in",
        to: [`u${i}@example.com`],
        subject: `S${i}`,
        body: "Body with enough text to avoid short penalty here.",
      });
    }
    expect(store.listNodes("draft")).toHaveLength(3);
    store.setStatus(store.listNodes("draft")[0]!.id, "discarded");
    expect(store.listNodes("draft")).toHaveLength(2);
  });

  test("importance bounds", () => {
    const low = scoreOutboundImportance({
      subject: "hi",
      body: "yo",
      to: ["a@b.com"],
    });
    const high = scoreOutboundImportance({
      subject: "Urgent invoice payment",
      body: "Please pay the invoice ASAP. Critical contract follow-up.",
      to: ["a@b.com", "c@d.com"],
      templateId: "tpl_x",
    });
    expect(low.score).toBeGreaterThanOrEqual(0);
    expect(low.score).toBeLessThanOrEqual(100);
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.score).toBeLessThanOrEqual(100);
  });
});
