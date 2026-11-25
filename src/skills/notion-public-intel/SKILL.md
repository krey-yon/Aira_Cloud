---
name: Notion Public Intel
description: Analyze what anyone can publicly discover about a Notion page or share link. Covers access posture, space identity, public content outline, and last-updated "X ago" timing. Use for public Notion URLs, notion.site pages, share-link research, "what can people see", or "when was this Notion page last updated". Do not use for creating or editing private workspace pages. Use the authenticated Notion skill for those.
---

You research public Notion pages only. No token. No writes. Never invent private content or a last-updated time Notion did not expose.

## Tools

| Tool | Use for |
|------|---------|
| `notion_analyze_public_page` | Full public dossier (access, identity, outline, timestamps, OG fallback) |
| `notion_public_last_updated` | Quick "updated X ago" answer from a URL or page id |
| `webfetch` | Optional HTML fallback when the dossier content is thin |
| `websearch` | Third-party mentions of the URL or title (label as external) |

Provide a `notion.so` / `*.notion.site` URL or a raw page id to either tool.

## Workflow

1. Call `notion_analyze_public_page` with the URL or page id. Use `notion_public_last_updated` when the user only asked when it was updated.
2. Read `access.verdict` first.
3. If content is thin but the page is public, optionally `webfetch` the canonical URL.
4. Optionally `websearch` the canonical URL and title for mirrors or mentions.
5. Emit the report in the fixed section order below.

### Stop / handoff

- `login-required`, `not-public`, `deleted`, or `not-found`: report posture only. Do not guess content.
- If the user owns the page and needs private content or edits, route to the authenticated Notion skill (`notion_*` tools + `NOTION_TOKEN`).

## Report shape

1. **Verdict.** public / login-required / not-public / deleted / not-found
2. **Sharing posture.** role, share-link flags, space domain / name
3. **Page identity.** title, id, canonical URL, icon/cover when public
4. **Freshness.** `content.updatedAgo` / `lastEditedTime` when present, for example "updated 3 hours ago". If missing, say so under gaps.
5. **Content snapshot.** outline + child page/db counts
6. **Web mentions.** search hits, or "none found" (third-party)
7. **Not visible publicly.** explicit gaps

## Freshness rules

- Prefer tool fields `updatedAgo` + `lastEditedTime`. Phrasing: "Last updated 2 days ago (2026-…T…)."
- Never invent a timestamp. If `available` is false or `updatedAgo` is null, say public last-updated is not available.
- `createdAgo` is optional context, not a substitute for last updated.

## Boundaries

- Do not call authenticated `notion_*` tools from this skill path.
- Do not bypass login walls or scrape private workspace content.
- Do not treat OG/HTML guesses as stronger than the public API dossier.
