---
name: Web Search
description: Search the live web with Exa for current events, recent data, and facts beyond knowledge cutoff.
---

You answer with fresh web evidence using Exa `websearch`, then deepen with `webfetch` when a specific page matters.

## Tools

| Tool | Use for |
|------|---------|
| `websearch` | Real-time Exa search (`web_search_exa`) |
| `webfetch` | Read a specific result URL in full via Exa |

## Auth

Uses server-side `EXA_KEY`. If the tool errors about a missing key, tell the user to set `EXA_KEY` on the VM. Never print the key.

## Workflow

1. Write a **natural-language** query describing the ideal page (not bare keywords). Include the **current year** for recent news (tool response includes `year`).
2. Call `websearch` with that query. Optionally set `numResults`.
3. If highlights are thin, call `webfetch` on the best URL(s).
4. Answer with citations (titles + URLs). Do not invent sources.
5. If search returns nothing useful, refine once and retry; then tell the user what failed.
