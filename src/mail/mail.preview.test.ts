import { describe, expect, test } from "bun:test";
import {
  cleanMailBody,
  cleanMailPreview,
  displayFrom,
  isLikelyPromo,
  pickRecentCards,
  type MailPreviewInput,
} from "./mail.preview";

describe("displayFrom", () => {
  test("splits a named address", () => {
    expect(displayFrom('Ada Lovelace <ada@example.com>')).toEqual({
      from: "ada@example.com",
      fromName: "Ada Lovelace",
    });
  });

  test("uses the address when there is no display name", () => {
    expect(displayFrom("ada@example.com")).toEqual({
      from: "ada@example.com",
      fromName: "ada@example.com",
    });
  });
});

describe("cleanMailPreview", () => {
  test("drops tracking URLs, tags, and footer junk then clamps", () => {
    const raw = [
      "<p>Ship the Q3 roadmap by Friday.</p>",
      "See https://track.example.com/click?u=abc&amp;x=1",
      "www.promo.example/offer?utm=1",
      "Unsubscribe if you no longer want these emails",
      "https://really-long-tracking.example.com/pixel/",
    ].join(" ");

    expect(cleanMailPreview(raw)).toBe("Ship the Q3 roadmap by Friday. See");
  });
});

describe("cleanMailBody", () => {
  test("strips URL dumps so a roadmap stays readable", () => {
    const raw = [
      "Q3 roadmap",
      "https://ci.example.com/1 https://ci.example.com/2 https://ci.example.com/3",
      "Launch the grants page.",
    ].join("\n");

    expect(cleanMailBody(raw)).toBe("Q3 roadmap\n\nLaunch the grants page.");
  });
});

describe("isLikelyPromo", () => {
  test("treats promotion and social labels as promo", () => {
    expect(isLikelyPromo({ labelIds: ["CATEGORY_PROMOTIONS"] })).toBe(true);
    expect(isLikelyPromo({ labelIds: ["CATEGORY_SOCIAL"] })).toBe(true);
    expect(isLikelyPromo({ labelIds: ["INBOX", "CATEGORY_UPDATES"] })).toBe(false);
  });

  test("flags list-unsubscribe marketing without dropping updates", () => {
    expect(
      isLikelyPromo({
        subject: "Weekend sale — 40% off",
        snippet: "Unsubscribe in one click",
        listUnsubscribe: "<mailto:unsub@shop.example>",
      }),
    ).toBe(true);
    expect(
      isLikelyPromo({
        subject: "Your invoice is ready",
        snippet: "Invoice #441 is attached.",
        labelIds: ["INBOX", "CATEGORY_UPDATES"],
        listUnsubscribe: "<mailto:unsub@billing.example>",
      }),
    ).toBe(false);
  });
});

describe("pickRecentCards", () => {
  function msg(partial: Partial<MailPreviewInput> & { id: string }): MailPreviewInput {
    return {
      from: "Ada <ada@example.com>",
      subject: "Roadmap",
      date: "Thu, 10 Sep 2026 00:00:00 +0000",
      snippet: "Ship the grants page this week.",
      ...partial,
    };
  }

  test("keeps the first five non-promo cards and never backfills with promo", () => {
    const messages = [
      msg({ id: "p1", labelIds: ["CATEGORY_PROMOTIONS"], snippet: "40% off https://x.example/a" }),
      msg({ id: "r1", subject: "Roadmap 1", snippet: "Ship lane one." }),
      msg({ id: "r2", subject: "Roadmap 2", snippet: "Ship lane two." }),
      msg({ id: "p2", subject: "Flash sale", snippet: "Unsubscribe for deals" }),
      msg({ id: "r3", subject: "Roadmap 3", snippet: "Ship lane three." }),
      msg({ id: "r4", subject: "Roadmap 4", snippet: "Ship lane four." }),
      msg({ id: "r5", subject: "Roadmap 5", snippet: "Ship lane five." }),
      msg({ id: "r6", subject: "Roadmap 6", snippet: "Ship lane six." }),
    ];

    expect(pickRecentCards(messages)).toEqual([
      {
        id: "r1",
        from: "ada@example.com",
        fromName: "Ada",
        subject: "Roadmap 1",
        preview: "Ship lane one.",
        date: "Thu, 10 Sep 2026 00:00:00 +0000",
      },
      {
        id: "r2",
        from: "ada@example.com",
        fromName: "Ada",
        subject: "Roadmap 2",
        preview: "Ship lane two.",
        date: "Thu, 10 Sep 2026 00:00:00 +0000",
      },
      {
        id: "r3",
        from: "ada@example.com",
        fromName: "Ada",
        subject: "Roadmap 3",
        preview: "Ship lane three.",
        date: "Thu, 10 Sep 2026 00:00:00 +0000",
      },
      {
        id: "r4",
        from: "ada@example.com",
        fromName: "Ada",
        subject: "Roadmap 4",
        preview: "Ship lane four.",
        date: "Thu, 10 Sep 2026 00:00:00 +0000",
      },
      {
        id: "r5",
        from: "ada@example.com",
        fromName: "Ada",
        subject: "Roadmap 5",
        preview: "Ship lane five.",
        date: "Thu, 10 Sep 2026 00:00:00 +0000",
      },
    ]);
  });
});
