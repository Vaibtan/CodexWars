# 06 — Start a synchronized battle and resolve bolt attacks

**What to build:** The organizer can start a synchronized countdown for a valid combat cohort, after which participants can fire the basic bolt and every client observes the same server-authoritative damage result.

**Blocked by:** 05 — Configure the combat cohort and lock safe positions.

**Status:** ready-for-agent

- [ ] Battle start requires at least two combat-included participants.
- [ ] Every combat participant must be connected, quiz-complete, localized, positioned, ready, and not eliminated.
- [ ] A blocked start returns every participant/reason pair and performs no partial combat initialization.
- [ ] A valid start initializes 100 HP, earned shield, fixed bolt loadout, cooldown, and elimination state exactly once.
- [ ] Countdown starts five seconds in the future and battle ends 60 seconds after `startsAt`; clients receive authoritative server time.
- [ ] Attacks are accepted only for the current round while battle is active and the sender is connected, localized, alive, positioned, off cooldown, and using the fixed bolt.
- [ ] Attack direction must be finite with magnitude in `[0.1, 2]` and is normalized by the server.
- [ ] Resolution starts from the locked position, ignores predicted target/AR/GLB data, and selects the nearest eligible ray-circle intersection.
- [ ] The P0 bolt uses 8 m range, 0.35 m ray radius, 10 damage, a one-second cooldown, unlimited charges, and the canonical 0.45 m player radius.
- [ ] Damage consumes shield before HP and clamps state without producing negative values.
- [ ] Each accepted attack emits ordered authoritative state/effect data carrying round, command, and event identifiers.
- [ ] Repeating a processed command returns its stored outcome and cannot apply damage twice.
- [ ] Unit/integration tests cover countdown boundaries, vector bounds, misses, aligned targets, range, cooldown, shield overflow, prediction distrust, and deduplication.
