# Durable mission sandbox

After `npm ci` and `npm run setup`, run `npm run sandbox` at the project root. Open http://127.0.0.1:62762/.

Choose 1, 3 or 5 **additional** actuators, review the authored route and begin. Close the page, leave the service running, then return for saved inventory, journey XP, journal receipts and a While you were away summary. Pause preserves remaining step time; Stop cancels an unfinished step while retaining earned rewards. Later missions extend the same synthetic character.

## Scope

One synthetic River profile is shared by this sandbox's tabs. It has no account key, live control or external gameplay endpoint. Artwork may be downloaded publicly; all character outcomes are fixtures. Only Scavenging and Engineering have fixture character state, while the full saved reference catalog remains browsable. Five seconds per step is test pacing, not a game ETA. This is not an optimization engine or native mechanics verification.

Fault controls exercise slow responses, interruption and uncertain results. Verify saved outcome reconciles the saved fixture receipt once and pauses without resubmitting a step. These guarantees apply to this local fixture only.

## Persistence and recovery

- `.local/sandbox-save/state.json`: versioned character, mission, pending step, receipts and revision with a SHA-256 checksum.
- `state.backup.json`: preceding verified snapshot. Writes sync a temporary file before replacement. Disk failure halts progress without publishing unpersisted outcomes.
- `writer.lock`: one writer; a dead process's lock can be reclaimed on restart.
- A corrupt primary and valid backup recover **paused**, visibly report recovery and archive the corrupt file. This can lose the latest snapshot. If both files are invalid, startup fails and preserves them.
- Browser storage holds a last-seen summary checkpoint only. Server saves are authoritative.

The computer must stay awake and the service running. On service restart, a valid running mission resumes. One already-due step can finish on recovery; queued steps run prospectively, with no bulk rewards for service downtime. Paused, stopped and blocked missions stay so. No startup service is installed.

Mutations are serialized. Start/select/resume/reconcile use the current revision; Pause/Stop use a mission ID so background progress cannot defeat interruption. The browser never automatically retries commands.

The experimental Work toward this checklist is shelved in the original checkout and excluded here.
