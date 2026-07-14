# 07 — Complete battles deterministically and reset rounds

**What to build:** Battles end once and produce identical standings for every client, and the organizer can start a clean rematch without stale commands, effects, rewards, or positions leaking across rounds.

**Blocked by:** 06 — Start a synchronized battle and resolve bolt attacks.

**Status:** ready-for-agent

- [ ] Reaching zero HP marks a participant eliminated exactly once and prevents later attacks.
- [ ] Last-alive completion runs after authoritative damage mutation and emits one final result.
- [ ] Timer completion ranks by remaining HP, then quiz score, then stable player-ID ordering.
- [ ] Exact ties never depend on collection iteration or event arrival order.
- [ ] Completed state contains winner, completion reason, and deterministic standings until reset/expiry.
- [ ] Late timers, attacks, disconnect callbacks, and repeated completion checks cannot emit a second winner.
- [ ] Eliminated participants remain connected to synchronized standings but cannot mutate combat.
- [ ] Reset is organizer-only and legal only in results.
- [ ] Reset retains connected room identities/display names/roles, increments `roundId`, and returns to lobby.
- [ ] Reset clears quiz answers/scores/rewards, localization, positions, readiness, HP/shield, cooldowns, eliminations, command outcomes, winner, and event sequence.
- [ ] Old-round commands/events are rejected or ignored after reset.
- [ ] Tests cover last-alive, timer, every tie level, exactly-once completion, eliminated commands, reset completeness, and stale-round traffic.
