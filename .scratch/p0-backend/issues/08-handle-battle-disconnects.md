# 08 — Handle battle disconnects without corrupting results

**What to build:** Temporary mobile network loss during countdown or battle preserves authoritative state long enough to recover, while timeout elimination and organizer loss cannot pause, rewind, or produce conflicting winners.

**Blocked by:** 03 — Restore pre-battle sessions after network drops; 07 — Complete battles deterministically and reset rounds.

**Status:** ready-for-agent

- [ ] A participant drop during countdown/battle marks them disconnected and disables attacks without deleting position, HP, shield, or cooldown.
- [ ] The server permits reconnection for exactly 20 seconds.
- [ ] Reconnection within the window restores the same player record and complete current room state.
- [ ] Grace expiry eliminates the disconnected participant exactly once and evaluates battle completion.
- [ ] Reconnect and timeout racing at the boundary produce one deterministic outcome.
- [ ] Commands queued before/during disconnection are not replayed as fresh combat actions.
- [ ] An organizer drop during countdown/battle leaves authoritative timers and combat running.
- [ ] Organizer-only controls remain unavailable until the original organizer reconnects; no participant gains the role.
- [ ] Disconnect-driven elimination composes correctly with simultaneous attacks, timer expiry, and last-alive completion.
- [ ] Tests use controlled clocks to cover reconnect-before-boundary, exact-boundary race, timeout, queued input, organizer drop, and exactly-once winner behavior.
