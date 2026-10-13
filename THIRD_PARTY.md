# Source provenance and upstream dependencies

This is a private development prototype, not an official Midnight City client.

- Companion UI, Contracts, Field Guide and mission sandbox modules were carried forward from development in `dlynch76dl-hub/midnight-city-companion-app` (checkout based on `1414914`, plus later working-copy implementation). No license file was present in that checkout. Do not infer redistribution permission from this import.
- Native Pixi modules come from publicly published Midnight City source maps listed with SHA-256 hashes in `scripts/renderer-manifest.json`. Local `provenance.json` records preparation time and manifest. Source maps, extracted modules, bundles and downloaded art are excluded from Git. Public maps/sprites are served from Midnight City's origin.
- `client/hybrid/game-catalog.json` contains saved public definitions imported October 12, 2026: content `d3344aed0240519f78c1be48c3f1406425aa36d5430cf7650d924955ed99ad2b`, static version `15572500041115259144`. It is reference data, not character state or current action authorization. `client/sandbox/catalog.json` is the reduced fixture catalog.
- PixiJS, esbuild, React and Three.js versions are pinned in `package-lock.json`; their own licenses apply. Renderer imports determine which dependencies enter a bundle.

Public source-map availability can change. Missing resources or changed hashes stop setup. Supported integration, update compatibility and rights to distribute game code/art/reference data require resolution before public release. Private storage and local download do not establish those rights.
