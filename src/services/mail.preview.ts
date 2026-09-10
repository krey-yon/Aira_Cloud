export const RECENT_FETCH_WINDOW = 15;
export const RECENT_CARD_LIMIT = 5;
export const PREVIEW_MAX_CHARS = 140;
export const RECENT_INBOX_QUERY =
  "-in:spam -category:promotions -category:social -category:forums";

export type RecentMailCard = {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  date: string;
};

export type MailPreviewInput = {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  labelIds?: string[];
  listUnsubscribe?: string;
  precedence?: string;
};

const PROMO_LABELS = new Set([
  "SPAM",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_FORUMS",
]);

const FOOTER_MARKERS = [
  /\bunsubscribe\b/i,
  /\bview (this )?(email )?in (your )?browser\b/i,
  /\byou(?:'re| are) receiving this\b/i,
  /\bmanage (your )?(email )?preferences\b/i,
  /\bthis email was sent to\b/i,
  /\bno longer wish to receive\b/i,
];

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const MARKETING_RE =
  /\b(?:unsubscribe|% off|limited time|view in browser|manage preferences|email preferences|sale|offer|deal|newsletter|promo)\b/i;
const LIST_JUNK_RE =
  /\bunsubscribe\b/i;
const LIST_JUNK_EXTRA_RE = /\b(?:sale|offer|deal|newsletter|promo|% off)\b/i;

export function displayFrom(raw: string): { from: string; fromName: string } {
  const trimmed = raw.trim();
  const angled = /^(.*?)\s*<([^>]+)>\s*$/.exec(trimmed);
  if (angled) {
    const name = (angled[1] ?? "").replace(/^["']|["']$/g, "").trim();
    const email = (angled[2] ?? "").trim();
    return { from: email, fromName: name || email };
  }
  return { from: trimmed, fromName: trimmed };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}

function stripMarkupAndUrls(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, " ")).replace(URL_RE, " ");
}

export function cleanMailPreview(text: string): string {
  let s = stripMarkupAndUrls(text);
  for (const re of FOOTER_MARKERS) {
    const idx = s.search(re);
    if (idx >= 0) s = s.slice(0, idx);
  }
  s = s.replace(/\s+/g, " ").trim();
  if (s.length <= PREVIEW_MAX_CHARS) return s;
  return s.slice(0, PREVIEW_MAX_CHARS).trimEnd();
}

export function cleanMailBody(text: string): string {
  let s = stripMarkupAndUrls(text);
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

export function isLikelyPromo(input: {
  labelIds?: string[];
  subject?: string;
  snippet?: string;
  listUnsubscribe?: string;
  precedence?: string;
}): boolean {
  for (const label of input.labelIds ?? []) {
    if (PROMO_LABELS.has(label)) return true;
  }

  const precedence = (input.precedence ?? "").trim().toLowerCase();
  if (precedence === "bulk" || precedence === "list" || precedence === "junk") {
    return true;
  }

  const text = `${input.subject ?? ""}\n${input.snippet ?? ""}`;
  if (input.listUnsubscribe && MARKETING_RE.test(text)) return true;
  if (LIST_JUNK_RE.test(text) && LIST_JUNK_EXTRA_RE.test(text)) return true;
  return false;
}

export function pickRecentCards(messages: MailPreviewInput[]): RecentMailCard[] {
  const cards: RecentMailCard[] = [];
  for (const message of messages) {
    if (cards.length >= RECENT_CARD_LIMIT) break;
    if (isLikelyPromo(message)) continue;
    const { from, fromName } = displayFrom(message.from);
    cards.push({
      id: message.id,
      from,
      fromName,
      subject: message.subject,
      preview: cleanMailPreview(message.snippet),
      date: message.date,
    });
  }
  return cards;
}
