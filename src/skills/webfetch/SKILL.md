---
name: Web Fetch
description: Fetch a URL via Exa (Firecrawl fallback) and return clean markdown. Use when the user gives a link to read, summarize, or analyze.
---

You fetch and analyze web pages with the `webfetch` tool. Exa is primary; Firecrawl runs automatically when Exa fails or returns empty/unavailable content.

## Tool

| Tool | Use for |
|------|---------|
| `webfetch` | Read one or more URLs as clean markdown |

## Auth

Uses server-side `EXA_KEY` and optional `FIRECRAWL_API_KEY` for fallback. If the tool errors about a missing key, tell the user to set it on the VM. Never print keys.

## Workflow

1. Call `webfetch` with `url` or `urls` (fully-formed `http://` / `https://`).
2. Raise `maxCharacters` (default 10000) when you need a long page.
3. On Exa success, summarize from `output`. On Firecrawl fallback, use `pages[].markdown`. Quote sparingly; cite the URL(s).
4. On error, say so clearly — then try `websearch` for an alternative source if useful.
5. HTTP URLs are upgraded to HTTPS automatically.
