# Midnight City Companion

A local custom client for your existing self-hosted Midnight City agent, with a shared orchestrator, bring-your-own-AI connection and playable sandbox. Early prototype; unaffiliated with Midnight City. The strategy engine remains separate and is not bundled.

**Testing this PR with your own AI?** Start with the [friend setup guide and copy/paste Gemini prompt](docs/friend-test.md). The private repository requires access from PhelpsGG.

## Run locally

Install Node.js 24+ and Git, then:

```sh
git clone https://github.com/PhelpsGG/midnight-city-companion.git
cd midnight-city-companion
git switch codex/local-agent-setup
npm ci
npm run setup
npm start
```

Open **http://127.0.0.1:62761/**. The branch switch is needed while the initial PR is open.

Setup downloads hash-pinned public renderer sources into ignored `.local/renderer` and builds both clients. Internet access to Midnight City is required for setup and world/art resources. No engine repository, prior cache, account file or environment key is needed. Unavailable or changed pinned resources stop setup with an error. Later source edits only need `npm run build`.

In **Connection**, enter your existing API key, choose one of the returned agents, and open its observed state. This does not create an account or take control. See [Midnight City's Own AI setup instructions](https://midnight.city/docs/connect-to-midnight-city/hermes-openclaw/) for agent/key requirements.

**Connect control** is a separate explicit action. Stop other controllers first. The client refuses known active or unverifiable controllers and busy characters. **Disconnect & clear key** revokes AI pairing, pauses execution, releases its lease and clears the credential. Keys stay in local server memory, never browser storage or save files. Closing the page keeps the queue and owned lease running while the computer and Node service run. Restart requires reconnecting the key/control, pairing again and explicitly resuming saved work. Lost control never automatically reconnects.

In **Goals**, save your objective, choose a currently available action and specify craft batches. **Journal** records confirmed outcomes separately from queued, pending or uncertain work. In **Connection**, enable an AI connection and use the displayed MCP configuration in your own host. [AI setup, action coverage and verification](docs/ai-play.md) covers Codex, Claude Code and Gemini CLI. The GUI and AI share one character, queue and history; the companion does not collect model API keys.

## Included

- Native Pixi world with character follow, compact tabs, floating activity and observed session XP.
- Inventory and Skills from the selected character; unknown quantities and levels stay unknown.
- Contracts: available, tracked, locked and completed. Live bookmarks last for this connection only.
- Field Guide: item uses/acquisition, recipe requirements, workstations/locations and skill unlocks. The saved October 12 catalog includes 969 items, 728 recipes, 200 contracts and 19 skills.
- Durable shared action queue, pause/stop/resume, exact craft batches, receipt confirmation, duplicate-request protection and uncertain-outcome blocking.
- Local stdio MCP tools for state/capabilities, saved catalog search, goals, gameplay actions and pause/stop.
- A playable synthetic observer using the same GUI, orchestrator and MCP bridge; the older actuator-mission sandbox also remains available separately.
- **While you were away:** a durable welcome-back report with observed XP/level changes, contracts, item receipts versus inventory changes, recorded conversations and current work. Reopen the latest report from Journal.

## Returning to your character

Opening a character for the first time establishes a visit checkpoint. After time away, the report compares that checkpoint with a fresh observation. Continue playing or one of its detail buttons acknowledges the report; failed saves leave it unread. Closing without acknowledgement preserves it. AI reads and background work never mark a report seen, and visible tabs share a visit. Reports belong to the selected character.

Visible pages report presence every 15 seconds. Leaving/closing sends a best-effort departure notice; if a browser drops it, 60 seconds without visible presence establishes an absence. A rapid forced close/reopen may therefore count as the same visit. Keep the local Node service running for queued work and continuous event recording. Service restart retains the report/checkpoint but requires reconnecting, and explicitly warns about the recording gap.

XP, levels, contract completions and inventory changes come from observed state. Collected/used totals use only explicit event receipts and may be partial; a net inventory change is not a count of everything acquired. Social activity counts recorded messages, identified threads and partners. Native connection/relationship gains are unavailable until a confirmed counter is provided. Missing observations, event-window gaps and bounded history are labeled. Reports do not store conversation text. Visit history is local and shared by browser sessions using this installation, not a cloud account or per-person record.

## Limits

The client exposes **11 allowlisted action kinds**. Four have full synthetic execution coverage; the others have protocol/receipt mapping tests. Production gameplay has not been exercised. Whole-game coverage, optimal planning and a permanent AI decision loop are not claimed. Saving a goal does not create a plan or infer completion. An active AI host decides further steps; the runtime finishes already queued actions without a browser. The old engine integration and experimental floating checklist remain excluded.

The world port supports native Pixi districts. Construction Yard's separate 3D renderer and unsupported/private areas remain unsupported. This is not full native-client parity. XP gains use a persisted baseline from the first control connection; they reflect observations, not attribution of every gain to this client. Saved catalog definitions may lag the game; current game capabilities gate actions.

Accepted submissions are not successes. A new matching event confirms the result. Uncertain work blocks later dispatch and is never automatically resent. Missing/truncated native event history requires manual investigation. There is no upstream idempotency guarantee; receipt attribution across controller handoffs is unverified.

Local claim coordination prevents this server's sessions from acquiring one agent simultaneously. Protection against an external controller racing the read/claim window depends on upstream atomic guarantees that have not been verified. Keep other controllers stopped when trying control setup.

## Sandbox and development

```sh
npm run sandbox
```

Open **http://127.0.0.1:62764/**. Use `sandbox-test-key`, choose River or Juniper and Connect control. In Goals, choose **Craft · sandbox plank**, enter **5** batches and queue it. Confirm five planks and +50 Crafting XP, then deliver the practice contract for ten synthetic crystals. Pair your AI from Connection to use exactly the same runtime. These are authored fixtures, not native mechanics. Gameplay never falls back to production; public art is used for rendering.

To try the return report, queue a craft and close the page before it finishes, leave the service running, then reopen after a minute. The report shows the new XP, planks collected and wood used. Dismiss it, then use **Journal → While you were away** to reopen it. Reports/checkpoints persist under the runtime's `visits` directory; playable sandbox and normal client histories are separate.

The older actuator missions are available via `npm run sandbox:legacy` on 62762 with their existing separate saves. See [legacy sandbox persistence](client/hybrid/mission/README.md).

```sh
npm test
npm run lint
npm run build
npm run test:browser
```

The browser-test service runs on **62763**. Use fake key `sandbox-test-key` to discover `test-river` and `test-juniper`. Agent/control operations are synthetic; public artwork is fetched for rendering. Automated tests do not contact production agents.

All services bind to `127.0.0.1`; do not expose them publicly. Credentials, bundles, downloaded upstream code, saves and runtime files are ignored under `.local`. Keep saves and pairing files private. `PORT` overrides the client or playable-sandbox port. History is in `.local/orchestrator`; synthetic state is separate in `.local/play-sandbox`. Preserve failed saves for investigation. Both primary and backup contain dispatch intent before an action is sent. A running save is locked against a second writer.

## Attribution and release status

This carries forward companion UI and sandbox development from the local `dlynch76dl-hub/midnight-city-companion-app` prototype. Native renderer code, art and game definitions originate from Midnight City; they are not represented as original companion work. Renderer sources/art/bundles are downloaded locally and excluded from Git.

See [THIRD_PARTY.md](THIRD_PARTY.md). This private development repository does not resolve upstream licensing or supported integration/distribution arrangements. Those remain prerequisites for a public release.
