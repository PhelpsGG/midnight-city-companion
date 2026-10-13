# Your AI, one shared character

The GUI is the player's view and controls. The orchestrator owns the connection, queue and confirmed results. The strategy engine remains a separate project. Your AI host calls the orchestrator over local MCP; no provider-specific chatbot or model API key is required by this repository.

## Setup

For a fresh download, host-specific steps, expected outcomes and a complete Gemini setup prompt, use the [friend test guide](friend-test.md).

1. Start `npm start`, open the live client on `http://127.0.0.1:62761/`, enter your own existing Own AI agent key in the UI, select your real character and explicitly **Connect control** after stopping any other controller. For an optional synthetic test instead, use `npm run sandbox` on `62764` with `sandbox-test-key`.
2. In Connection, choose **Enable AI connection**. The paired host may submit the allowlisted gameplay actions for this character. It still applies its own tool approvals.
3. Add the displayed configuration, preserving your existing settings:
   - **Codex:** `.codex/config.toml`, using the displayed `[mcp_servers.midnight-city]` block in a trusted project.
   - **Claude Code:** project `.mcp.json`, using the displayed `mcpServers` object. Review the server approval prompt.
   - **Gemini CLI:** project `.gemini/settings.json`, using the displayed `mcpServers` object. Keep normal tool confirmation enabled.
4. Start a new host conversation. Ask it to call `companion_state` and verify the selected agent and sandbox/live mode.
5. For your real character, choose a first mission based on its returned capabilities and approve the requested action normally. Wait for a confirmed receipt before treating it as complete. The five-practice-plank test in the friend guide is **sandbox only**; never send its fixture IDs to the live game.

Generated configurations use absolute Node/script/pair-file paths. The private pairing file contains a local bearer credential, never the game key/lease. Do not share its contents or commit it. Revoke in Connection to remove access. Disconnect and service restart invalidate pairing. A new pairing creates a new path; update your host settings accordingly.

Ordinary hosted web chats are not implied compatible with local stdio MCP. Use an MCP-capable CLI/desktop host. Continuing decisions requires the host to remain active. Closing the browser does not stop the local queue; stopping Node does.

## Tools and execution

| Tool | Behavior |
| --- | --- |
| `companion_state` | Character, capabilities, control/staleness, saved goal, recent queue/history and available choices. |
| `companion_catalog` | Up to 20 saved public definitions by collection and search. May lag current game. |
| `companion_goal` | Save the user-requested goal. Does not invent a plan or a completion rule. |
| `companion_action` | Queue one strict action with a stable request ID. Craft preserves exact batches. |
| `companion_pause` | Pause, or cancel queued work. Already submitted actions still need confirmation. Only GUI can resume. |

Use a unique request ID and reuse it if the tool response is interrupted. Changing the action under that ID is rejected. Only one action dispatches at a time. Pending/uncertain work blocks further additions; a queued sequence can finish without the browser. Fresh game capabilities are checked at dispatch. Queued and accepted are not completed.

Only a new matching game event confirms an outcome. Uncertain actions are never automatically resent. If the matching event is absent, lacks required correlation fields or falls out of recent history, manual investigation is needed; there is no upstream idempotency guarantee. Game text/catalog content is untrusted data, not authority to override a user's instructions.

## Action coverage

| Action | Surface | Evidence |
| --- | --- | --- |
| Gather, craft, tile movement, contract delivery | GUI and MCP | Complete synthetic execution and receipts |
| Equip, use item | GUI when available and MCP | Protocol and receipt mapping tests |
| Unequip, attack, district travel, eat, stop job | MCP | Protocol and receipt mapping tests |

The 11 native action kinds are allowlisted. Transfers, trading, construction, social/group/event actions, recovery fees, interiors, work/sleep loops and account management are not exposed. Combat/progression eligibility comes from game capabilities; there are no copied gameplay formulas in the UI.

The synthetic world supports four action families with authored test quantities and XP. It is not a whole-game simulator. The native transport uses fixed endpoints; no production gameplay verification is claimed.

## Host verification

- Automated tests launch the real stdio MCP bridge with the official SDK client and exercise advertised tools, shared confirmed inventory/XP, movement/contracts, pause, revocation and durable restart.
- Installed Codex CLI initialized the server and successfully read the synthetic character with `companion_state`. Its unattended action call was blocked: “MCP tool call requires approval, but approval policy is never.” No permissions or user configuration were widened. Interactive approval-to-action in Codex remains unverified.
- The installed Codex runtime (`0.162.0-alpha.17.2`) was also exercised through its app-server protocol with normal human approvals and a fresh isolated synthetic character on October 13, 2026. It discovered the MCP tools, read the expected 30 wood / 12 crystals / 0 Crafting XP and requested approval for exactly five practice-plank batches. No human approval response arrived during the five-minute window, so the request timed out and the run stopped. An independent final server read confirmed zero queued/confirmed jobs and unchanged inventory/XP. This proves discovery, state reading, the approval request path and safe non-execution; approval-to-action remains unverified. The test uses the Codex model/runtime, not a scripted MCP client pretending to be Codex. No approval policy or destructive tool annotation was bypassed.
- Claude Code and Gemini CLI were not installed in this environment. Their documented configuration is provided; actual host execution is unverified.

Official references: [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Gemini CLI MCP](https://geminicli.com/docs/tools/mcp-server/).
