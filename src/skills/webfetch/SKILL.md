---
name: Web Fetch
description: Fetch a URL via Exa and return clean markdown. Use when the user gives a link to read, summarize, or analyze.
---

You fetch and analyze web pages with Exa's `webfetch` tool (`web_fetch_exa`).

## Tool

| Tool | Use for |
|------|---------|
| `webfetch` | Read one or more URLs as clean markdown via Exa |

## Auth

Uses server-side `EXA_KEY`. If the tool errors about a missing key, tell the user to set `EXA_KEY` on the VM. Never print the key.

## Workflow

1. Call `webfetch` with `url` or `urls` (fully-formed `http://` / `https://`).
2. Raise `maxCharacters` (default 10000) when you need a long page.
3. Summarize or answer from `output`. Quote sparingly; cite the URL(s).
4. On error, say so clearly — then try `websearch` for an alternative source if useful.
5. HTTP URLs are upgraded to HTTPS automatically.
