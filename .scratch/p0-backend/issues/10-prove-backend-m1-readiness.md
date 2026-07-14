# 10 — Prove backend M1 readiness with 12 participants

**What to build:** A repeatable automated backend rehearsal proves the complete P0 room-to-rematch flow at target capacity and fails CI if authority, timing, recovery, privacy, or performance regresses.

**Blocked by:** 09 — Harden protocol, privacy, and abuse boundaries.

**Status:** ready-for-agent

- [ ] A scripted scenario creates one organizer plus 12 participants and completes create → join → quiz → localization → positioning → countdown → battle → results → reset.
- [ ] The scenario includes duplicate nicknames, one quiz-only participant, valid distinct positions, shield bands, hits, elimination, and deterministic winner.
- [ ] A worst-case near-deadline answer burst from all participants scores once and advances on the authoritative clock.
- [ ] A maximum permitted attack burst remains correct under the 100 ms Schema patch configuration and produces no duplicate damage/effects.
- [ ] Participant and organizer reconnect scenarios complete without duplicate records, lost state, replayed commands, or conflicting results.
- [ ] A simulated server restart invalidates the session cleanly while a new server reports healthy/ready and accepts a new room.
- [ ] Concurrent room creation proves active four-digit IDs never collide and disposed IDs are released.
- [ ] Contract snapshots prove answer keys, options, tokens, and AR/camera data do not leak.
- [ ] The suite runs with network access disabled and no Firebase credentials/configuration.
- [ ] Backend typecheck, unit tests, integration tests, and the capacity rehearsal run in CI from a clean checkout.
- [ ] The test output records duration, participant count, command/event totals, and failures clearly enough to diagnose a regression.
- [ ] Two consecutive clean runs produce identical authoritative winner/standings for deterministic fixtures.
