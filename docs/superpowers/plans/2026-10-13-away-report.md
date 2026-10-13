# While you were away

> Execute inline using executing-plans and TDD; independent final review before updating existing PR #1.

**Goal:** Approved welcome-back overlay, durable last-visit checkpoints, reopenable Journal report, confirmed changes and honest gaps. Keep the existing style, engine separate and live agent disconnected.
**Architecture:** Separate durable AwayReports store next to the orchestrator. Background observation records normalized public events; only CSRF-protected GUI presence/acknowledgement moves the visit checkpoint. The same captured character supplies report and other panels. No AI visit tool. No gameplay formulas.
**Tech:** Existing Node/Pixi/HTML shell, MissionStore, node:test.
**Spec:** User approved the preceding in-chat description and explicitly requested implementation/testing/PR.

## Constraints and rulings
- Reuse clean owned feature checkout in C:/Dev/midnight-city-companion. Original prototype/engine untouched.
- New visit begins after an explicit last-tab departure or 60 seconds without visible-tab presence. Heartbeat every 15 seconds; close/visibility notifications are best effort, with timeout fallback. Presence across tabs is coalesced.
- First visit establishes a baseline, never invents prior gains. A pending report remains until acknowledged and can be reopened from Journal. A later return can extend an unacknowledged report. Stale acknowledgements cannot dismiss a newer report.
- Per-character durable state and bounded event retention; service restarts/history gaps/truncation are labeled. Stale/missing observations cannot overwrite checkpoints or mark reports seen.
- Snapshot differences show net changes. Only explicit event effects count as recorded acquisition/consumption. Conversations count recorded messages, threads and partners, not invented social progression. Unsupported connection/relationship counters stay unavailable.
- Overlay has semantic dialog, keyboard/focus handling, dismiss/reopen controls, current activity and links to detail surfaces. Synthetic provenance is explicit.

## Task 1 — durable accounting and presence
Files server/away-reports.mjs, tests/away-reports.test.mjs. RED tests for first visit, before/after XP/levels/items, receipts vs net changes, duplicate events, social events, missing observations, pending/ack/stale ack, multiple tabs, restart and isolation. Implement a serial store with observe/visit/view APIs.

## Task 2 — integrate observer and browser
Files server/app.mjs, server/orchestrator.mjs, client/live/away-panel.mjs, main.js, index.html, style.css; focused HTTP and projection tests. All observation paths feed the recorder; only browser visit route changes seen state. Engine and MCP execution contracts unchanged. Test AI refresh doesn't consume a report.

## Task 3 — sandbox acceptance and delivery
Use synthetic actions with actual background runtime; close browser, let work finish, return, verify totals/details, dismiss/reopen and service restart. Check missing social coverage and responsive styling. One full integration gate, independent review, record evidence/limitations, commit/push existing draft PR.

## Ledger
- Pre-flight: recorder uses public observations without control; orchestrator callback records after refreshed/confirmed state. API reads never acknowledge. UI presence is a separate explicit route.
- Task 1 complete: atomic checksummed visit history, per-character checkpoints, event deduplication/retention, exact-version acknowledgement and rollback on failed saves. New tests were run RED before implementation; 8 recorder regressions now pass.
- Task 2 complete: the observer, shared orchestrator and AI state reads feed the recorder. Only the CSRF-protected GUI visit route updates presence/acknowledgement; MCP has no visit operation. Connected HTTP regression crafts five items via the paired sandbox bridge while absent, verifies +50 XP, earned/used quantities and an unread report through repeated AI reads. Projection test verifies escaping, provenance and coverage labels.
- Task 3 complete: browser queued five practice crafts, closed the page, reopened after the presence timeout and displayed +50 Crafting XP / 5 planks collected / 5 wood used / net +5 and -5. Reload preserved the unread report. Review activity acknowledged it and opened Journal; Journal reopened it and Escape restored focus to the initiating button. Service restart retained history, required reauthentication, resumed observation only with execution paused and surfaced a recording-gap warning.
- Responsive browser check: 390x844 single-column report, no horizontal overflow (clientWidth = scrollWidth = 340), reachable acknowledgement controls. Desktop screenshot: ignored `.local/evidence/away-report.png`. Main viewport restored. Replacing an open report originally lost keyboard focus; the reproduced browser check now focuses Continue playing after reload/report refresh.
- Independent read-only review identified three important gaps, all fixed in one RED-to-GREEN pass: offline observations must invalidate freshness; removed/invalid skill entries need a coverage warning; unavailable events must remain labeled in each report period. No deferred review findings.
- Final integration gate: `npm test` 109/109 passing; `npm run lint` syntax checked 82 modules; `npm run build` built both bundles; `git diff --check` clean. Tests and browser actions used synthetic characters only. Normal client inspection returned authorized=false, controlled=false, agent=null.
- Measured limitation: CUA forced tab close did not reliably deliver the departure request. Returning within 11 seconds counted as the same visit; closing beyond 60 seconds correctly produced the report. This fallback is documented, not represented as instantaneous close detection. Native connection/relationship gains and complete receipt capture remain unverified; the UI labels these limits. No changes to the engine, original prototype, live gameplay or automation.
- Delivery: update the already-authorized private draft PR #1; retain the existing feature branch and checkout. Follow-up: validate native event/counter coverage on an explicitly authorized recorded dataset before claiming full social/economic accounting.
