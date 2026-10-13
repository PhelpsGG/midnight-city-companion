# Portable local agent client â€” design and execution ledger

## Approved intent

Shelve the floating checklist. Save the companion/custom client in a new repository under PhelpsGG, using a PR. First make it usable by someone downloading and running it locally with their own existing self-hosted agent. Keep the owner's live agent disconnected throughout development.

## Implementation decisions

- New private repository PhelpsGG/midnight-city-companion in C:/Dev/midnight-city-companion; current proof-of-concept and saves remain untouched. Node 24, ESM, existing Pixi renderer integration and ember tab styling.
- First portable connection milestone: start locally, enter an existing owner API key, discover authorized agent IDs, choose one, inspect verified character state, Inventory, Skills, Contracts and Field Guide, follow the character in the native world, explicitly acquire/release control. Setup and refresh never acquire control; an existing controller blocks acquisition. No gameplay actions, automatic missions or strategy-engine dependency in this first live shell. These are explicitly unavailable, not simulated successes.
- Key stays in the local server's browser session; reconnect after restart. No arbitrary upstream URL, inherited environment token, personal default, external skill installation or browser storage of credentials. No persistent-key option in this milestone.
- Loopback-only service; Host/Origin/CSRF checks; bounded requests; generic secret-free errors; per-browser/per-agent connection state; stale state labels; explicit disconnect. Expiration releases owned control, never auto-reclaims.
- Keep durable synthetic mission client as a separate sandbox command with its own save. Import current Contracts/Field Guide/style/components and focused tests. Exclude personal data, engine research, old credentials and superseded UI experiments.
- Prepare native renderer into ignored local storage from pinned public source-map resources with provenance/hashes. Never put upstream source/art/bundles in Git. Fresh installs prepare or give an actionable unavailable-resource message. Public source availability and supported integration/distribution arrangements remain release limitations. No C:/Dev/MidnightCity dependency.
- Local observer test double drives onboarding/control/loss/disconnect/browser tests with synthetic state and never falls back to production. Existing scripted action missions stay synthetic. Native production verification is not claimed.

## Bounded plan

- [x] Shelf checklist and restore original sandbox interface; 38 affected tests pass, save preserved.
- [x] Import minimal source set and portable npm setup/build/start, renderer preparation and attribution. Verify clean-directory install/build.
- [x] TDD connection service: authorized discovery, selection/control, wrong key/agent/offline/busy/stale/session expiry/disconnect, no credential leakage or implicit claim.
- [x] Connect styled live shell and reusable catalog panels to shared observations; native follow; unsupported goal/action states; fake-observer browser checks.
- [x] Final focused integration gate, independent review, staged private-data scan, commits, new private repository and draft PR. Attach PR. New local client starts disconnected.

## Review focus

Owner switching/stale tabs cannot display or act as another owner. Credentials never in URLs/logs/responses/bundles. Unknown control status cannot authorize takeover. Control loss/restart never auto-reclaims. Fresh clone must not need original caches or engine. Keep recognizable style and explicitly unavailable actions.

## Evidence and rulings

- Original origin inaccessible; user chose a new project under PhelpsGG. Current GitHub login PhelpsGG verified. New project isolates changes from the dirty original checkout.
- Checklist source archived in original checkout .local/shelved-floating-checklist. Sandbox save preserved. No engine-chat coordination.


## Verification — October 13, 2026

- Independent review identified cookie-renewal, stale-tab identity, expired-lease renewal and competing-browser acquisition issues. Each has a targeted regression and fix. Bounded re-review found no remaining important issue; stale connection wording was also qualified.
- Final integration gate: 76 tests pass (~1 second test runtime), syntax checked 65 JavaScript modules, both bundles build. Tests cover connection/control lifecycle, actual transport mapping using fake fetch, session invalidation, imported catalog panels and durable sandbox recovery. No production agent calls or gameplay actions were used.
- A clean export of tracked files installed 16 dependencies via npm ci (~11 seconds), prepared 352 hash-verified published renderer modules, and built both bundles (~3.4 seconds setup/build). A server started from that export returned HTTP 200, authorized=false, agent=null, controlled=false. No original workspace/cache was copied into the export.
- Browser: invalid synthetic key rejected; correct key discovers two agents; River and Juniper selection, native map/follow, inventory (8 actuators, 12 crystals), observed and unknown skills, item guide, explicit control, reload and disconnect checked. Two-tab disconnect clears previous identity/world/control and requires reload. Latest follow marker includes the world host offset.
- Portable sandbox on 62762 completed one actuator with the tab closed. Reopening showed exactly 3 saved fixture receipts, +58 Scavenging XP, +48 Engineering XP and Goal complete. Automated process-death/restart and backup recovery regressions also pass.
- Original sandbox 62759 still shows its existing 8 actuators and prior completed mission; floating checklist is removed. Original unrelated dirty work and saved character retained.
- Known boundaries: saved catalog guidance can become stale; native 3D/private areas unsupported; no live action execution/engine integration; XP baseline resets on reload; upstream atomic no-takeover guarantees and production control behavior unverified; integration/licensing before public release unresolved. Registry guards one local server process only.
- Next increment: review this connection-first PR, resolve upstream integration/control contract, then add a separately reviewed live action/runtime adapter without restoring old one-action-per-click engine assumptions.


## Delivery

- Private repository verified: https://github.com/PhelpsGG/midnight-city-companion (default main).
- Draft PR #1: https://github.com/PhelpsGG/midnight-city-companion/pull/1, base main, branch codex/local-agent-setup. Attached to the current chat. No merge/deployment.
- Main client is running disconnected on 62761; portable sandbox on 62762. Original sandbox 62759 remains available. Temporary synthetic observer 62763 stopped after QA.
- Screenshots are local ignored evidence: .local/evidence/synthetic-client.png and disconnected-client.png. No credentials, runtime files, upstream renderer sources/art/bundles or saves committed. Original checklist remains recoverable in the original checkout.
