# Shared orchestrator and own-AI play

> For agentic workers: use executing-plans; implement inline with TDD and a fresh-context final review.

**Goal:** Download, connect an existing agent, explicitly enable control, then play through GUI or a paired MCP AI using the same confirmed state and durable queue.

**Architecture:** Loopback Node service owns credentials, lease and execution. A strict action contract and event receipts sit behind both HTTP and stdio MCP. The knowledge/strategy engine remains external. A durable synthetic observer runs the identical client/service path without production fallback.

**Tech Stack:** Node 24, existing Pixi shell, MCP TypeScript SDK, Zod, node:test.

**Spec:** Approved user direction and docs/local-agent-client.md (October 13 clarification).

## Global constraints
- Work on existing isolated companion branch/PR #1; preserve originals and live disconnection.
- No engine imports, formulas, AI-provider keys, global AI configuration or engine-chat contact.
- Explicit control and AI pairing. Server-side secrets; bounded loopback requests; no raw upstream proxy.
- Persist intent before dispatch; accepted is not confirmed; uncertain actions block subsequent work and are never retried automatically.
- Browser closure does not stop queued work while Node runs. Restart requires reauthentication/control/resume, retaining history. AI decisions require the user's AI host.

## Review focus
Concurrent GUI/AI requests, duplicate IDs, stale/foreign state, recovery after ambiguous dispatch, control loss, pair revocation, secret exposure, and clean install without the engine or old caches.

### Task 1: Shared action contract and durable orchestrator
Files: server/actions.mjs, server/orchestrator.mjs, server/connection.mjs, client/play/live.mjs, tests/orchestrator.test.mjs.
Interface: normalized allowlisted actions -> fresh capability validation -> persisted submission -> new matching event -> confirmed/failed/uncertain history. Runtime attach requires owned connection. A paused queue can reconcile receipts but cannot submit.
Write failing tests for serialization, batching, duplicate IDs, stale state, uncertainty, pause/stop, recovery and receipt matching. Implement and run focused tests. Never infer success from HTTP acceptance or inventory deltas alone.

### Task 2: Same-path sandbox and paired MCP
Files: server/sandbox.mjs, server/sandbox-start.mjs, server/app.mjs, ai/*, tests/bridge.test.mjs, tests/sandbox.test.mjs.
Interface: browser connection/session -> explicit pair file -> stdio tools -> shared runtime. Revocation/disconnect invalidates bridge. A durable synthetic transport supplies genuine local action receipts, independent of UI assumptions.
Write failing full HTTP/MCP and restart tests. Implement adapters/strict tools and test with actual stdio SDK client. Pin dependencies, provide Codex/Claude Code/Gemini CLI settings without editing user configuration. List unverified hosts honestly.

### Task 3: Connected player controls and delivery
Files: client/live/*, README.md, docs/ai-play.md, scripts/*, tests/*.
Interface: observed character + durable runtime view drive goal, action choices, queue, history, XP and AI setup. Keep style and show sandbox provenance. Skills/items/contracts consume existing catalog; live capability data gates actions.
Implement focused UI projection tests, then browser check connect/control/goal/manual action/AI action/pause/close/reopen/disconnect. Run one integration gate and clean export install/setup/play. Independent final review, fix material issues, commit/push existing draft PR with accurate coverage and limitations.

## Execution ledger
- Ruling: reuse clean codex/local-agent-setup checkout, already isolated from original dirty prototype and engine; no unrelated writer active here.
- Pre-flight: Tasks 1->2 share runtime API and Connection ownership; Tasks 1/2->3 share one projected runtime and pairing metadata. No second UI state machine or sandbox-specific UI.
- MCP targets local CLI/desktop hosts with stdio support; ordinary hosted web chats are not implied compatible.
- Task 1 complete: strict 11-action schema, capability recheck, exact batches, durable shared history, control ownership, pause/stop/resume and receipt reconciliation. Intent persisted in both primary and backup before dispatch. RED->GREEN tests covered initial missing runtime, ambiguous delivery and refresh collisions.
- Task 2 complete: full same-path synthetic observer, HTTP pairing/revocation and five stdio MCP tools. Actual SDK client acceptance covers four gameplay families, shared state, control gating and restart. Native adapter mappings tested without network. Engine excluded.
- Task 3 complete: compact Goals/Journal/AI controls, persisted XP baseline, floating goal/status, setup/coverage documentation. Browser confirmed five planks and +50 XP, then closed the page; MCP delivered the contract and reopening showed 22 crystals and both GUI/AI receipts. Existing style preserved.
- Independent review found and verified fixes for pairing revocation across identity changes, refresh colliding with dispatch intent, recovering runtime ownership after control loss, and disconnect during an AI read. No important issue remained in the reviewed scope.
- Hard-kill test terminates a child during dispatch, corrupts its primary save and restores backup intent. No second submission occurs; a later matching receipt resolves the uncertainty.
- Integration gate: 99 tests pass (1.5 seconds), 77 JS modules syntax checked, both bundles build, diff whitespace check passes. Fixed an existing 300ms timing assumption in the legacy background-mission test using bounded passive observation; it still verifies no client request drives progress.
- Clean indexed export: npm ci (111 packages, 12 seconds, zero audit vulnerabilities), setup downloads 352 pinned public modules and builds; the actual stdio download/connect/play/restart acceptance test passes from that export. No old cache, engine or credential copied.
- Codex CLI initialized the bridge and read synthetic state; unattended mutation blocked by its approval policy. No permissions changed. Interactive Codex mutation and actual Claude Code/Gemini host execution remain unverified. Production gameplay remains unverified.
- Ruling: goals remain user/AI intent, with no automatic plan or inferred completion rule while the engine is separate. Sandbox mechanics are authored test fixtures. Unsupported systems stay rejected rather than exposed through a raw-action proxy.
