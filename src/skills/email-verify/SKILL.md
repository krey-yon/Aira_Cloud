# email-verify

Check whether an email address is actually deliverable before you trust it, in
four ordered stages. Verdicts are plain-English (`deliverable`,
`not_deliverable`, `catch_all`, `reject`, `invalid`, `inconclusive`) so a caller
can act without decoding SMTP codes.

## When to use

Use it to sanity-check a contact/recruiter/company email found on a job posting,
a website, or a handoff, before sending a follow-up. It is a single-address
checker, not a bulk list tool.

## Workflow

Call the `email-verify` tool with the address (and optionally `port`, `timeout`,
`sender`). Read the returned `verdict` and `summary`. The tool decides the stage
order and branching; you only interpret the verdict.

Stages, in order:

1. **Syntax** — if the address is malformed, stop: `invalid`.
2. **DNS/MX** — does the domain have mail routing? No MX record and no A record
   (implicit MX) → `reject` (not deliverable). No MX but a bare A record → uses
   the A record as the mail exchanger per RFC 5321.
3. **Catch-all** — probe a random `random-<n>x@domain`. If the server accepts it
   (250), the domain is a catch-all, so a 250 on the real address proves nothing:
   verdict becomes `catch_all`.
4. **SMTP recipient probe** — EHLO, MAIL FROM, RCPT TO. The tool maps the RCPT
   code to a verdict:
   - 250 → `deliverable` (unless catch-all, above).
   - 251 / 252 / 450 / 451 / 421 → `inconclusive` (forwarding, cannot-verify,
     greylisting, or temporary outage — never a hard no).
   - 550 / 551 / 553 / 554 / any 5xx → `not_deliverable`.

## Output

The tool returns `verdict` + a one-line English `summary` per address, plus
`domain`, `catchAll`, and `mx`. Present the verdict and summary to the user.

## Interpretation rules

- `inconclusive` is honest, not a failure: port 25 is often blocked by
  residential ISPs, and many servers greylist or defer. Never upgrade an
  `inconclusive` to a yes/no; report it as "could not verify".
- A 5xx that is really a **sender/IP rejection** (the message names a policy,
  dynamic/residential IP, or a blocklist like Spamhaus — or the same 5xx is
  returned for the random catch-all address) rejects the *connection*, not the
  mailbox. The tool reports `inconclusive`, never `not_deliverable`, for these.
- A catch-all domain makes SMTP acceptance meaningless — trust the `catch_all`
  verdict, not the 250.
- `reject` / `invalid` are the only hard negatives that let you discard an
  address.
