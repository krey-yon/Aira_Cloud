# Gmail

Compose, draft, schedule, and send mail through the connected Gmail account on Aira.

## When to use

Mailbox work for the signed-in operator. Templates by id, Aira-local drafts on the console board, scheduled sends, and importance scores.

## Workflow

1. If Gmail may be disconnected, call `gmail_status` first.
2. Prefer templates when the user names a template id (`tpl_…`). Call `gmail_draft_from_template`.
3. Otherwise write with `gmail_draft_upsert`.
4. Do not claim send or schedule success unless the tool returns `ok: true`.
5. To send now, call `gmail_draft_send_now` with the draft id.
6. To send later, call `gmail_schedule_send` with a future `runAt` or a delay.
7. To drop a draft or cancel a scheduled send, call `gmail_draft_discard`.
8. Call `gmail_score_importance` when the user asks how important a draft is.
9. Use `gmail_list_messages` / `gmail_get_message` to read recent inbox mail.
10. Keep `email_verify` for deliverability checks before trusting a new address.

## Rules

- Drafts live in Aira until send. They are not Gmail Drafts folder items.
- After drafting, tell the user the draft id and that it is on the aira.kreyon.in mail board.
- Never invent a template id. List templates if the id is unknown.
- Keep answers short. Include ids and `runAt` when scheduling.
