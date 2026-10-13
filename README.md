# Midnight City Companion

A local custom client for your existing self-hosted Midnight City agent, plus an isolated mission sandbox. Early prototype; unaffiliated with Midnight City.

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

**Connect control** is a separate explicit action. Stop other controllers first. The client refuses known active or unverifiable controllers and busy characters. **Disconnect & clear key** releases its lease and clears the credential. Keys stay in local server memory, never browser storage or save files. Restart requires entering the key again. Closing the page lets control expire; maintaining control requires browser refreshes. Inactive local sessions expire after 30 minutes. Lost or expired control requires explicit reconnection.

## Included

- Native Pixi world with character follow, compact tabs, floating activity and observed session XP.
- Inventory and Skills from the selected character; unknown quantities and levels stay unknown.
- Contracts: available, tracked, locked and completed. Live bookmarks last for this connection only.
- Field Guide: item uses/acquisition, recipe requirements, workstations/locations and skill unlocks. The saved October 12 catalog includes 969 items, 728 recipes, 200 contracts and 19 skills.
- A separate durable synthetic mission sandbox with progress, reward feedback and a return summary.

## Limits

The portable connection client **does not send gameplay actions or run live missions**. Goals and Journal explain this in the UI. The prior engine integration and experimental floating checklist are not enabled. Control setup has only been exercised with synthetic observers; production-control success is not claimed.

The world port supports native Pixi districts. Construction Yard's separate 3D renderer and unsupported/private areas show an unavailable state. This is not full native-client parity. Session XP resets on page reload. Saved catalog definitions may lag the game; catalog eligibility is guidance, not server-verified action permission.

Local claim coordination prevents this server's sessions from acquiring one agent simultaneously. Protection against an external controller racing the read/claim window depends on upstream atomic guarantees that have not been verified. Keep other controllers stopped when trying control setup.

## Sandbox and development

```sh
npm run sandbox
```

Open **http://127.0.0.1:62762/** for a synthetic River character with authored 1/3/5-actuator missions. No account key or live gameplay endpoint is connected. The service continues while the page is closed if the computer and service remain running. See [sandbox persistence and recovery](client/hybrid/mission/README.md).

```sh
npm test
npm run lint
npm run build
npm run test:browser
```

The browser-test service runs on **62763**. Use fake key `sandbox-test-key` to discover `test-river` and `test-juniper`. Agent/control operations are synthetic; public artwork is fetched for rendering. Automated tests do not contact production agents.

All services bind to `127.0.0.1`; do not expose them publicly. Credentials, bundles, downloaded upstream code, saves and runtime files are ignored under `.local`. Keep saves private. `PORT` can override the client port; sandbox and browser-test ports are 62762 and 62763.

## Attribution and release status

This carries forward companion UI and sandbox development from the local `dlynch76dl-hub/midnight-city-companion-app` prototype. Native renderer code, art and game definitions originate from Midnight City; they are not represented as original companion work. Renderer sources/art/bundles are downloaded locally and excluded from Git.

See [THIRD_PARTY.md](THIRD_PARTY.md). This private development repository does not resolve upstream licensing or supported integration/distribution arrangements. Those remain prerequisites for a public release.
