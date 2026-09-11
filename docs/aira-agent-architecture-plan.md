# Aira agent architecture plan

Rebuild Aira's agent as planner, skill registry, executor, and artifacts so Assist stops inventing Notion pages and can grow past 40 skills. Operators edit skills on aira.kreyon.in with a markdown editor. Runtime work lands first (PR-A1 through PR-A4), then the console editor and graph (PR-B1, PR-B2). The operator lands the stack.

[![](https://mermaid.ink/img/pako:eNplVO1uGjsQfZWRf_WqCYSvUtBVpS2J0kQkUFiUqkt_mN1hceO1ke0NSUOkvkPf4T5Yn-SOvUvapogfa4_PmZnjM35kqc6QDdla6l264cZB_H6pgH62XOWGbzcwkgKVs9UuwCJZWDTQhMhaYR1suUTn8MshPpkmky0a7rQBrYALwxu3Bh-0aghVn0KVLVX1uYDj43d7bm_B4b2D18SX40grv9rDzTy5mVOuD3E8ha96VeNpj1BwOUsu9WpWKoWmjlzOQmQ6TqaS-_1_V6b5zhZcSkgr1i-H1NNxyF2g4xl3nKqVD3uYnZ0nr-a3ggAzzKlD8xA45h_HwuE_dR46FcAiA8ULhAxtasTWCWrZ8dyC01raPeV4ka318_uPDtjALzLrG6ZC9zCeRKfJWPOsjq10JtDW2Xww9DWaXE2TkS622iIIRcWVqc9pQ4mpNkiEFUHBzW2md-olRTyZjOdJTOUBiaJ3x5J6DPBS-er1uiJohA6exfKZA_7sU3J2j2lJ9xtQH3eoIEflrxzjSl8PCHlqxIHk7FPQwDNDStlJoDh55WupGrjWQcDzggsJO1yBTTeYlRJ_fv_voHwcKLxLgn6lkSS2cBKJLJrFSWScWPPUWVjxvMbQfkAZLEk35Y1mHW73f5UG0fU8iZTdPRuKNkLg5uI0uRFZjo7sSP7DOz8Ufx7aS61yqJw7iq6TpmkOySApV3fcNl8QjifnSUS6OZA6f5Z5Uom8uEiCBS2Ng0JZQxcXlWHrmwXMhJ8yspDBO4E7-qptN5otTiuG8AnR9KLmCEufghz8PIOBF85n0fRDjapG35PWuBAM6RW9GN63SGLYfcXz24kGHUlrhzbB6NLR6Y0gsfw0sCOWG5GxITkXj1iBhu6aluzRkyyZ22CBSzakzwzXvJRuyZbqiWAkxGetiwOSiPMNG665tLQqtzTBeCo41f3rCD0zaEa6VI4NW91e4GDDR3bPhsfd_qDfaPc7nW53cNI9eUvRB9putweNVqvTbfdOer12_23nzdMR-xby9hqDQaffPukNuq1un_5HrLqAq-oJDS_p0_-ira-K?type=png)](https://mermaid.live/edit#pako:eNplVOFuGjkQfpWRf7W6BAIsR0GnSlsSpYm4QGFRqi79YXaHxY3XRrY3JBci9R3uHfpgfZIbe5fcNYf4YXv8fTPz-Zt9YpnOkY3YRup9tuXGQfJhpYB-tloXhu-2MJYClbP1KcAyXVo00IbYWmEd7LhE5_DrMT6dpdMdGu60Aa2AC8NbdwYftWoJ1dxCla9UvVzC6en7A7d34PDBwW_EV-BYK787wO0ivV1Qro9JMoNvet3g6YxQcD1Pr_V6XimFpolcz0NkNklnkvvzP9am_d6WXErIatavx9SzSchdouM5d5yqlY8HmF9cpm8Wd4IAcyyoQ_MYOBafJsLh2yYP3QpgkYPiJUKONjNi5wS17HhhwWkt7YFyvMrW-fn97x7YwC9y6xumQg8wmcbn6UTzvImtdS7QNtl8MPQ1nv45S8e63GmLIBQVV2U-pw0lZtogEdYEJTd3ud6r1xTJdDpZpAmVBySK3p9K6jHAK-Wr15uaoBU6eBHLZw74i8_pxQNmFb1vQH3ao4IClX9yTGp9PSDkaRBHkovPQQPPDBllJ4GS9I2vpW7gRgcBL0suJOxxDTbbYl5J_Pn9x1H5JFB4lwT9KiNJbOEkElk8T9LYOLHhmbOw5kWDofOAMliRbsobzTrcHf5XGsQ3izRWdv9iKDoIgdur8_RW5AU6siP5D-_9UPx66SC1KqB27ji-SdumPSKDZFzdc9t-RTiZXqYx6eZA6uJF5mkt8vIqDRa0NA4KZQNdXtWGbV4WMBd-yshCBu8F7mnV2G48X57XDGEJ8eyq4Qhbn4Ic_DKDgRcu5_HsY4OqR9-TNrgQDOkVfTG8b5HEsIea5z83WnQlaxzaBqMrR7e3gsTy08BOWGFEzkbkXDxhJRp6a9qyJ0-yYm6LJa7YiJY5bngl3Yqt1DPBSIgvWpdHJBEXWzbacGlpV-1ogvFccKr73yv0mUEz1pVybNSJosDBRk_sgY1Oo8Fw0OoOer0oGp5FZ-_6J-yRjrvdYavT6UXd_lm_3x286_3-fML-Cnn7reGwN-ie9YdRJxrQ__kfK6yo9A)

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-stack.md`. Owners build and verify. The root appends a linear stack. The operator reviews and merges bottom-up. PR-B1 and PR-B2 are review-gated.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on her explicit go.
- [ ] On her go, arm a `/goal` with this exact text. "Run `/Users/vikas/dev/assistant/extenstion/cloud/docs/aira-agent-architecture-plan.md` under autopilot-stack. PR order PR-A1, PR-A2, PR-A3, PR-A4, PR-B1, PR-B2. A PR is verified only when its unit, live, and perf boxes are all checked. The operator merges. Done when Assist finds an existing Notion page before writing, and aira.kreyon.in edits skills live."
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md`
  - [ ] `git show origin/main:pstack/skills/swarm/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md`
  - [ ] `git show origin/main:pstack/skills/how/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/architect/SKILL.md`
  - [ ] Control skill path is a risk in Appendix C until `control-ui` is installed. Live lanes drive HTTP and the console with curl plus Playwright or the installed control skill.
- [ ] Arm the 30-minute audit tick. In a local session, a real terminal `/loop`. In a cloud root, a cloud-sleeper wake chain. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk and the armed /goal. Audit the operation against both and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then send the operator a status message, whether or not anything changed, with the queue table of PR, owner, state, and head SHA, the verdicts since the last tick, what merged, open operator gates, and blockers."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle the execution playbook names.
- [ ] Follow this dependency graph. Start dependent work only after its parent merges, or base it on the parent branch when the execution playbook stacks.
  - [ ] PR-A1 is first from `main`.
  - [ ] PR-A2 after PR-A1.
  - [ ] PR-A3 after PR-A2.
  - [ ] PR-A4 after PR-A3.
  - [ ] PR-B1 after PR-A4.
  - [ ] PR-B2 after PR-B1.
- [ ] Hold the file boundaries. PR-A1 through PR-A4 touch `src/skills/**`, `src/agent/**`, `src/tools/**`, `src/http/**`, `src/persist/**`, and tests. PR-B1 and PR-B2 touch `console/**` plus skill CRUD routes under `src/http/**`.
- [ ] Hold the review gate. PR-B1 and PR-B2 change an interaction. They wait for the operator's review in chat with screenshots and a video before merge.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Default to `gh`; if `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Record any fallback to `gh`. Never require `gt`.
- [ ] Open the PR ready, never draft, with `origin pr create --status open --base <base-branch>` or `gh pr create --base <base-branch>` according to the resolved forge. A stack child targets its parent branch.
- [ ] Run the repo's lint and typecheck once before the PR-facing push. Push with hooks on.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `../references/bugbot-triage.md`.
- [ ] Rebase onto current trunk before babysit and again before the merge-ready report.

### Verdict and merge, for every PR

- [ ] At the merge-ready head SHA, run the swarm per `pstack/skills/swarm/SKILL.md`. One gates lane. The ten live lanes from the PR's **Verify, live** block. The perf lane from its **Verify, perf** block. One audit lane that reads the diff and the receipts and distrusts the PR body.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner. A new head gets a fresh swarm and a fresh verdict.
- [ ] Root appends the PR to the linear base-branch stack after a clean verdict. The operator lands bottom-up. Patch-id rules follow `playbooks/shipping.md`.

### Boot recipe, for every live lane

Each live lane runs on its own cloud VM at the PR head. Drive through `control-ui` when installed. Until then use curl for `/v1/*` and a headed browser for the console.

- [ ] `git fetch origin <head-branch> && git checkout <head SHA>`.
- [ ] Start the cloud server with `bun --hot ./index.ts`. Wait until `GET /v1/skills` returns 200 with a token.
- [ ] Deliver input only through the control skill's commands, or through curl and the browser when the control skill is missing. Name the read-only diagnostics as `GET /v1/logs` and job events.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report.

## Seed the skill registry (PR-A1)

**Depends on.** None.

**Files.**

- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/skills/types.ts`.
- [ ] Create `/Users/vikas/dev/assistant/extenstion/cloud/src/skills/skill.store.ts`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/skills/index.ts`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/tools/index.ts`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/config.ts`.
- [ ] Create `/Users/vikas/dev/assistant/extenstion/cloud/src/skills/skill.store.test.ts`.

**Build.**

- [ ] Add `SkillRecord` with `id`, `name`, `description`, `tags`, `instructions`, `tools`, `maxSteps`, `edges`, and `updatedAt`.
- [ ] Add SQLite `SkillStore` via `openSqlite`, seeded once from bundled `SKILL.md` packs when the table is empty.
- [ ] Add `getToolsFor(names)` so callers can pass an allow-list. Keep `getTools()` as the full set for tests only.
- [ ] Keep file packs as seed and export source. Do not write Redis as the source of truth.

**You see.**

- [ ] `GET /v1/skills` returns at least the six seeded skills with `tags` and `tools` arrays in the JSON body.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `skill.store.test.ts` covers seed-once, update body, list metadata without bodies, and load three bodies by id. Run `bun test src/skills/skill.store.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `GET /v1/skills` at trunk and head. Trunk lacks `tools` fields. Gate that head returns `tools` arrays and still authenticates. Save `a1-skills-shape.png`. Pass when the head JSON includes `tools` on every skill.
- [ ] Lane 2. Cold boot with empty `SKILLS_DB`. Save `a1-seed.png`. Pass when six skills exist after boot.
- [ ] Lane 3. Second boot does not duplicate rows. Save `a1-seed-idempotent.png`. Pass when the count stays six.
- [ ] Lane 4. Update one skill body through the store API used by tests. Save `a1-update.png`. Pass when reload shows the new body hash.
- [ ] Lane 5. Metadata list omits instruction bodies over 200 chars in the list endpoint payload. Save `a1-meta-only.png`. Pass when list entries have no full `instructions` field.
- [ ] Lane 6. `getToolsFor(["websearch"])` rejects gmail tool keys. Save `a1-tool-filter.png`. Pass when the filtered set has only the named tools.
- [ ] Lane 7. Unknown tool name in a skill record is dropped with a log line. Save `a1-unknown-tool.png`. Pass when the log contains the drop and the run still starts.
- [ ] Lane 8. `SKILLS_DB` path override writes under a temp dir. Save `a1-db-path.png`. Pass when the sqlite file exists at that path.
- [ ] Lane 9. Export helper writes markdown files under a temp dir matching ids. Save `a1-export.png`. Pass when six `.md` files exist.
- [ ] Lane 10. Assist ask still returns an answer on the default path. Save `a1-assist-smoke.png`. Pass when the widget or `/v1/logs` shows `answer`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time to list metadata for 40 skills and load 3 bodies.
- [ ] Probe. Insert 40 rows, then time `listMetadata` plus `loadBodies([id1,id2,id3])` at trunk-equivalent file reads and at head store calls, interleaved.
- [ ] Baseline. Record the trunk file-read time first from the scratch prototype numbers in Appendix A.
- [ ] Rule. Head list+load stays under 50ms on the lane VM. Fail if head exceeds 50ms.

**Review gate.** None. PR-A1 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] Root appends PR-A1 to the stack. The operator lands it.

## Add the planner and scoped executor (PR-A2)

**Depends on.** PR-A1.

**Files.**

- [ ] Create `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/planner.ts`.
- [ ] Create `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/planner.test.ts`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/agent.service.ts`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/types.ts`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/llm.service.ts` only if a second small model call is required for planning.

**Build.**

- [ ] Add a planner that reads skill metadata only and returns 1 to 3 skill ids plus a short plan string.
- [ ] Change `AgentService.run` to load those bodies, compose a core prompt plus skill bodies, and pass `getToolsFor(union of skill.tools)`.
- [ ] Keep Qwen as the executor model. Planner may reuse the same model with a tiny prompt.
- [ ] Honor an explicit client `skillId` as a hard include in the selected set.

**You see.**

- [ ] A Notion-flavored ask logs selected skills including `notion` and does not attach gmail tools when the plan excludes gmail.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `planner.test.ts` covers metadata-only input, max three skills, and explicit `skillId` pin. Run `bun test src/agent/planner.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Same short factual ask at trunk and head. Save `a2-regression-answer.png`. Pass when head still answers without tool errors.
- [ ] Lane 2. Ask about the current tab product with page context. Save `a2-web-route.png`. Pass when selected skills include `websearch` or `webfetch`.
- [ ] Lane 3. Ask to draft Gmail. Save `a2-gmail-route.png`. Pass when selected skills include `gmail` and tools include a `gmail_` key.
- [ ] Lane 4. Ask to update Notion. Save `a2-notion-route.png`. Pass when selected skills include `notion`.
- [ ] Lane 5. Ask with no domain hint. Save `a2-general.png`. Pass when at most three skills load and the answer returns.
- [ ] Lane 6. Explicit `skillId=webfetch` on `POST /v1/ask`. Save `a2-pin.png`. Pass when the answer event `skillId` list contains `webfetch`.
- [ ] Lane 7. Unknown `skillId` falls back instead of failing the job. Save `a2-unknown.png`. Pass when status is `done` not `error`.
- [ ] Lane 8. Tool event stream shows only allowed tools for a web-only plan. Save `a2-scoped-tools.png`. Pass when no `gmail_` tool event appears.
- [ ] Lane 9. Planner metadata prompt size stays under a logged character budget. Save `a2-meta-budget.png`. Pass when the log line is under the budget constant.
- [ ] Lane 10. Scheduled task with `skillId` still runs. Save `a2-schedule.png`. Pass when the schedule executor completes without throw.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Extra planner latency on a short ask, plus end-to-end time to first tool or final answer.
- [ ] Probe. Time the same short ask at trunk and head, interleaved, five times each.
- [ ] Baseline. Record trunk median end-to-end first.
- [ ] Rule. Head planner overhead stays under 1500ms median. End-to-end may rise by that budget only. Fail if planner alone exceeds 1500ms median.

**Review gate.** None. PR-A2 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] Root appends PR-A2 to the stack. The operator lands it.

## Teach find-then-write with artifacts (PR-A3)

**Depends on.** PR-A2.

**Files.**

- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/skills/notion/SKILL.md`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/tools/notion.tools.ts` or the Notion tool module path found at build time.
- [ ] Create `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/artifacts.ts`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/job.runner.ts`.
- [ ] Create `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/artifacts.test.ts`.

**Build.**

- [ ] Add an artifact bag on the job for tool outputs the next step must reuse (Notion page ids, urls, titles).
- [ ] Rewrite the Notion skill so named destinations require `notion_search` or read before create or write.
- [ ] Prefer updating an existing page when search returns a confident match for phrases like "watch later" under an "llm" parent.
- [ ] Record the chosen page url on the final answer.

**You see.**

- [ ] Ask "add this to the watch later Notion page under llm" searches first, then writes to the matched page, and the answer contains the Notion url.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `artifacts.test.ts` covers append, read, and clear across steps. Run `bun test src/agent/artifacts.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Simple non-Notion ask at trunk and head. Save `a3-regression.png`. Pass when head still answers.
- [ ] Lane 2. Load-bearing Notion ask against a fixture workspace with a known "watch later" page. Save `a3-find-write.png`. Pass when tool order is search-or-read before write-or-create, and the url matches the fixture page.
- [ ] Lane 3. Same ask twice does not create a second page with the same title. Save `a3-idempotent.png`. Pass when page count for that title stays one.
- [ ] Lane 4. Ambiguous Notion match calls `ask_user` once. Save `a3-ask.png`. Pass when a question widget appears and the job continues after reply.
- [ ] Lane 5. Missing Notion credentials returns a clear error without a fake url. Save `a3-auth.png`. Pass when the answer has no `notion.so` claim of success.
- [ ] Lane 6. Artifact bag appears in job events after search. Save `a3-artifact-event.png`. Pass when an event payload includes the page id.
- [ ] Lane 7. Canvas still opens for long answers. Save `a3-canvas.png`. Pass when `/r/:id` loads.
- [ ] Lane 8. Gmail draft path still works after Notion skill changes. Save `a3-gmail-smoke.png`. Pass when a draft appears or the tool returns `ok`.
- [ ] Lane 9. Websearch ask still works. Save `a3-web-smoke.png`. Pass when an answer returns.
- [ ] Lane 10. Operator log shows selected skills for the Notion ask. Save `a3-log-skills.png`. Pass when the log payload lists `notion`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Tool-step count and end-to-end time for the watch-later Notion ask.
- [ ] Probe. Run the fixture ask at head five times. Trunk lacks find-then-write, so also record trunk's create-page behavior as the baseline to beat on correctness, and set absolute budgets on head.
- [ ] Baseline. Trunk creates a new page (record that fact). Head must not.
- [ ] Rule. Head uses at least one search-or-read before write. End-to-end under 90s on the lane VM. Fail if a create happens when a match exists, or if runtime exceeds 90s.

**Review gate.** None. PR-A3 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] Root appends PR-A3 to the stack. The operator lands it.

## Harden the runtime and delete the megaprompt (PR-A4)

**Depends on.** PR-A3.

**Files.**

- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/skills/general-assistant/SKILL.md`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/job.runner.ts`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/skills/email-verify/SKILL.md`.
- [ ] Delete dead watcher `skillId` execution gaps or wire them in one place only.

**Build.**

- [ ] Shrink `general-assistant` to core tone and routing-agnostic rules. Move product guidance into specialized skills.
- [ ] Make prose `<ask_user>` either continue the agent like the tool path or hard-fail with a retry instruction. Pick one behavior and delete the other.
- [ ] Fix `email-verify` tool name mismatch.
- [ ] Raise default `maxSteps` for composed runs to a value the planner sets from the selected skills.

**You see.**

- [ ] Default Assist asks no longer ship the old kitchen-sink instructions string in the model request log.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Extend `present-answer` or job-runner tests for the chosen ask_user behavior. Run `bun test src/agent/`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Short ask at trunk and head. Save `a4-regression.png`. Pass when head answers.
- [ ] Lane 2. Schedule ask still schedules through the tool. Save `a4-schedule.png`. Pass when `schedule_task` returns `ok` and the answer keeps the task id.
- [ ] Lane 3. Forced prose ask_user path matches the chosen behavior. Save `a4-ask-path.png`. Pass when the predicate in the build notes holds.
- [ ] Lane 4. Email verify tool name works when that skill is selected. Save `a4-email-verify.png`. Pass when the tool event name is `email_verify`.
- [ ] Lane 5. Notion find-then-write still passes after prompt shrink. Save `a4-notion.png`. Pass when search precedes write.
- [ ] Lane 6. Instruction character count for a default ask drops versus trunk. Save `a4-smaller-prompt.png`. Pass when head instructions length is lower than trunk's general-assistant file length.
- [ ] Lane 7. Cancel still marks queued jobs. Save `a4-cancel.png`. Pass when a queued cancel becomes cancelled.
- [ ] Lane 8. Unknown skill fallback still works. Save `a4-fallback.png`. Pass when status is `done`.
- [ ] Lane 9. Mail board draft path still works. Save `a4-mail.png`. Pass when draft create returns `ok`.
- [ ] Lane 10. Watcher create still works. Save `a4-watcher.png`. Pass when `create_watcher` returns `ok`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Instructions character count and end-to-end time for a short ask.
- [ ] Probe. Measure both at trunk and head, interleaved.
- [ ] Baseline. Record trunk instruction length and median latency first.
- [ ] Rule. Head instruction length is at least 30% smaller than trunk general-assistant. Median latency is not more than 10% slower than trunk. Fail either breach.

**Review gate.** None. PR-A4 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] Root appends PR-A4 to the stack. The operator lands it.

## Ship the skills markdown editor (PR-B1)

**Depends on.** PR-A4.

**Files.**

- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/console/shell/nav.ts`.
- [ ] Create `/Users/vikas/dev/assistant/extenstion/cloud/console/panels/skills/SkillsSheet.tsx`.
- [ ] Create `/Users/vikas/dev/assistant/extenstion/cloud/console/panels/skills/SkillEditor.tsx`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/http/routes.ts`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/console/api/client.ts`.

**Build.**

- [ ] Add a Skills dock panel with list, markdown editor, live preview, and tool multi-select.
- [ ] Add authenticated CRUD on `/v1/skills` for create, update, and get-by-id including instructions.
- [ ] Saving writes the SQLite registry and hot-reloads the in-process cache. No git write on save.
- [ ] Optional export button writes files for later commit.

**You see.**

- [ ] On aira.kreyon.in, the Skills panel edits a skill body, previews markdown, toggles tools, saves, and the next Assist ask uses the new body.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add `console/shell/nav.test.ts` coverage for the new `skills` panel id. Run `bun test console/shell/nav.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open console logs panel at trunk and head. Save `b1-regression-dock.png`. Pass when head dock still opens logs.
- [ ] Lane 2. Open Skills panel. Save `b1-open.png`. Pass when the skill list renders.
- [ ] Lane 3. Select `notion` and see markdown body. Save `b1-load.png`. Pass when the editor shows Notion headings.
- [ ] Lane 4. Edit text and see preview update. Save `b1-preview.png`. Pass when preview shows the edited phrase.
- [ ] Lane 5. Toggle a tool off and save. Save `b1-tools.png`. Pass when GET by id shows the tool missing.
- [ ] Lane 6. Create a new skill from the UI. Save `b1-create.png`. Pass when the list shows the new id.
- [ ] Lane 7. Assist ask routes to the new skill when its description matches. Save `b1-live-route.png`. Pass when logs show the new skill id.
- [ ] Lane 8. Unauthorized PATCH returns 401. Save `b1-auth.png`. Pass when status is 401.
- [ ] Lane 9. Export writes markdown files. Save `b1-export.png`. Pass when export response lists paths.
- [ ] Lane 10. Deep refresh returns to idle without crashing. Save `b1-refresh.png`. Pass when the stage renders after reload.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from save click to `200` on PATCH, and time to first Skills list paint.
- [ ] Probe. Measure save and list at head. Trunk lacks the panel, so set absolute budgets for the new work and the idle console paint.
- [ ] Baseline. Record idle console paint on trunk first.
- [ ] Rule. PATCH under 300ms server time. Skills list first paint under 2s. Idle console paint on head within 20% of trunk. Fail any breach.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 4 and lane 5 screenshots into `docs/media/PR-B1-review-preview.png` and `docs/media/PR-B1-review-tools.png`.
- [ ] Record a 30 to 60 second video of the change on a lane VM. Save it as `docs/media/PR-B1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] Root appends PR-B1 to the stack. The operator lands it after review.

## Ship the skill graph view (PR-B2)

**Depends on.** PR-B1.

**Files.**

- [ ] Create `/Users/vikas/dev/assistant/extenstion/cloud/console/panels/skills/SkillGraph.tsx`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/console/panels/skills/SkillsSheet.tsx`.
- [ ] Edit `/Users/vikas/dev/assistant/extenstion/cloud/src/skills/types.ts` if edge editing needs fields.

**Build.**

- [ ] Render skills as nodes and `edges` as links on the Skills panel.
- [ ] Clicking a node opens the same markdown editor.
- [ ] Editing an edge updates the registry and feeds the planner's compose hints.
- [ ] Keep the graph as a view over SQLite data. Do not invent a second graph document store.

**You see.**

- [ ] The Skills panel toggles a graph where `notion` links to related skills, and edits persist across reload.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add a pure graph-model test for nodes and edges derived from `SkillRecord[]`. Run `bun test console/panels/skills/` or the new test file path.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Skills editor from PR-B1 still opens on head. Save `b2-regression-editor.png`. Pass when the editor loads a body.
- [ ] Lane 2. Toggle graph view. Save `b2-graph.png`. Pass when nodes for seeded skills render.
- [ ] Lane 3. Click a node to open the editor. Save `b2-node-click.png`. Pass when the editor shows that skill.
- [ ] Lane 4. Add an edge in the UI and reload. Save `b2-edge-persist.png`. Pass when the edge returns from GET.
- [ ] Lane 5. Planner log mentions compose-with edge partners when relevant. Save `b2-planner-edge.png`. Pass when the selected set includes the edged partner for a fixture ask.
- [ ] Lane 6. Forty dummy skills still pan and zoom. Save `b2-forty.png`. Pass when all forty node labels exist in the DOM or canvas.
- [ ] Lane 7. Keyboard path returns to the list view. Save `b2-list.png`. Pass when the list is visible.
- [ ] Lane 8. Invalid edge to unknown id is rejected. Save `b2-bad-edge.png`. Pass when PATCH returns 400.
- [ ] Lane 9. Mobile width still shows editor or a clear empty state. Save `b2-mobile.png`. Pass when no horizontal clip hides Save.
- [ ] Lane 10. Assist still answers after graph edits. Save `b2-assist.png`. Pass when an answer event arrives.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Graph first paint with 40 skills, and edge save time.
- [ ] Probe. Measure at head. Trunk lacks the graph, so use absolute budgets plus list-view paint from PR-B1 as the related baseline.
- [ ] Baseline. Record PR-B1 list paint on the parent tip first.
- [ ] Rule. Graph first paint under 3s for 40 skills. Edge save under 300ms server time. Fail either breach.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2 and lane 4 screenshots into `docs/media/PR-B2-review-graph.png` and `docs/media/PR-B2-review-edge.png`.
- [ ] Record a 30 to 60 second video of the change on a lane VM. Save it as `docs/media/PR-B2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] Root appends PR-B2 to the stack. The operator lands it after review.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] Reply to the operator with the report the execution playbook names.

## Appendix A. Prototype evidence

Storage prototype path `/tmp/aira-skill-store-proto` with `RESULT.json`.

Measured for 40 skills with 385-char bodies.

- Files write 1.76ms, metadata 0.52ms, load 3 bodies 0.045ms.
- SQLite write 0.44ms, metadata 0.069ms, load 3 bodies 0.056ms, update 0.21ms.
- Redis unavailable (2s timeout against local default). Scheduler already treats Redis as optional via `REDIS_URL`.

Decision recorded. SQLite is the runtime source of truth. Bundled `SKILL.md` files seed an empty DB. Console save updates SQLite. Export-to-files is optional for git. Redis is rejected as primary store because it is optional in this repo and timed out in the prototype.

Unproven until PR-A3 live lanes. Whether Qwen follows find-then-write reliably with only skill text, or needs a hard tool-policy gate.

## Appendix B. Alternatives rejected

- Redis KV as primary registry. Optional in config, timed out locally, weaker fit next to canvas and mail SQLite stores.
- Write a file on every Save as the only store. Fine for git, bad for hot reload and metadata queries at 40+ skills without a scan cache.
- Keep `general-assistant` megaprompt and only add a UI. Does not fix Assist inventing Notion pages.
- Autopilot-full. Work is sequenced and the operator wants review on B. Autopilot-stack fits.

## Appendix C. Risks

- `control-ui` skill was not found in this environment. PR live lanes must name curl and browser steps until it is installed. Owned by every PR's boot recipe.
- Notion fixture workspace credentials for PR-A3 lanes. Owned by PR-A3. Without fixtures, the load-bearing lane cannot pass.
- Planner quality on Qwen. Owned by PR-A2 and PR-A3. Mitigate with explicit `skillId` pin and tool allow-lists even when the plan is weak.
- Hot reload across multiple server processes. Owned by PR-B1. Single Bun process is assumed. Multi-node needs a later cache bust.
- Graph library weight in the console. Owned by PR-B2. Prefer a small custom SVG or canvas before adding a heavy graph package.

## Appendix D. Links and reading list

- This plan. `/Users/vikas/dev/assistant/extenstion/cloud/docs/aira-agent-architecture-plan.md`
- Current skills. `/Users/vikas/dev/assistant/extenstion/cloud/src/skills/`
- Agent entry. `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/agent.service.ts`
- Job runner. `/Users/vikas/dev/assistant/extenstion/cloud/src/agent/job.runner.ts`
- Tools. `/Users/vikas/dev/assistant/extenstion/cloud/src/tools/index.ts`
- SQLite helper. `/Users/vikas/dev/assistant/extenstion/cloud/src/persist/sqlite.ts`
- Console dock. `/Users/vikas/dev/assistant/extenstion/cloud/console/shell/Dock.tsx`
- Notion tests today. `bun test src/integrations/notion.test.ts`
- PR-A1 and PR-A2 should run `how` before coding. PR-A2 should run `architect` for planner boundaries. PR-B1 should run `interrogate` on the editor UX if the first sketch feels generic.
- Decision trail. Use `show-me-your-work` once execution starts.
