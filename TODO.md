# CodexWars Backend TODO

**Status:** Active
**Last reviewed:** 2026-07-16
**Scope:** Remaining work required to make the P0 backend implementation complete and release-ready.

This file is an implementation tracker, not a product or protocol specification. Product behavior and wire contracts remain authoritative in:

- [PRD.md](PRD.md)
- [BUILD_SPEC.md](BUILD_SPEC.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [API_AND_REALTIME_SPEC.md](API_AND_REALTIME_SPEC.md)

## Current baseline

The backend already implements the main P0 loop:

- Colyseus room creation, four-digit admission, and session-bound reconnects
- Organizer and participant roles
- Fixed ten-question quiz, scoring, and shield rewards
- Character and palette validation
- Marker localization, position locking, countdown, and Bolt combat
- Cooldowns, damage, elimination, standings, and round reset
- State privacy controls, payload limits, rate limits, and command deduplication
- Health and readiness endpoints

The last verified baseline passed 29 server tests, 11 shared-package tests, 14 mobile unit tests, 9 mobile native-identity tests, and strict TypeScript checks for every workspace. The items below close the remaining correctness, coverage, and readiness gaps.

## Execution order

1. Fix participant disconnect and explicit-leave behavior.
2. Prevent public exposure of partial quiz scores.
3. Normalize matchmaking errors at the mobile/backend boundary.
4. Expand deterministic combat, position, negative-path, and lifecycle tests.
5. Complete a real twelve-combatant backend rehearsal.
6. Remove the obsolete duplicate HTTP server.
7. Run the complete P0 verification gate.

## P0-1: Participant disconnect and leave lifecycle

The lifecycle must be phase-aware so a disconnected participant cannot deadlock localization or battle startup, and a participant leaving an active round cannot disappear without elimination and winner evaluation.

### Required behavior

- [ ] In the lobby, an explicit participant leave removes the participant record.
- [ ] During quiz, localization, or positioning, an explicit leave retains the round record, marks the participant disconnected, clears readiness and position, and sets `combatIncluded` to `false`.
- [ ] During quiz, localization, or positioning, an unexpected disconnect retains the participant for the 20-second reconnect grace period.
- [ ] When that pre-countdown grace period expires, automatically exclude the participant from combat and clear readiness and position.
- [ ] During countdown or battle, retain the existing 20-second reconnect grace period for an unexpected disconnect.
- [ ] When an active-round reconnect grace period expires, eliminate the participant exactly once and re-evaluate whether the round has a winner.
- [ ] During countdown or battle, an explicit leave immediately eliminates the participant exactly once, re-evaluates round completion, and retains the record for standings.
- [ ] Preserve the organizer policies: 60-second grace before countdown, 20-second grace during countdown or battle, and no organizer role transfer.

### Acceptance criteria

- [ ] No disconnect or leave path can deadlock phase progression.
- [ ] Each active-round departure produces at most one elimination and one corresponding event.
- [ ] Reconnecting within the grace period restores the same authoritative participant record.
- [ ] Final standings remain stable after disconnects and explicit leaves.
- [ ] An explicit lobby leave does not leave a ghost participant.

## P0-2: Publish quiz scores only after quiz completion

`PlayerState.correctAnswers` is public synchronized state and must not expose a participant's running score while the quiz is in progress.

### Required behavior

- [ ] Maintain the running correct-answer count in private server state.
- [ ] Continue returning the participant's private running result through `quiz_answer_result` where required by the API contract.
- [ ] Keep public `PlayerState.correctAnswers` at its initial or last finalized value during questions and reveals.
- [ ] Publish the final correct-answer count and shield reward together when the complete quiz finishes.
- [ ] Clear both private running state and public finalized state during round reset.

### Acceptance criteria

- [ ] Public room state never exposes partial scores during question or reveal phases.
- [ ] Each participant receives the correct private answer result and running total.
- [ ] Quiz completion publishes the correct final score and shield reward.
- [ ] Reconnects do not expose selected answers or another participant's partial score.

## P0-3: Normalize matchmaking errors

The mobile realtime adapter must translate Colyseus lifecycle failures into the stable application error contract. This is a cross-boundary task required to finish the backend-facing client API.

### Required behavior

- [x] Map create, join, and reconnect failures to structured `WarRoomCommandError` values.
- [x] Cover `CLIENT_VERSION_UNSUPPORTED`, `ROOM_NOT_FOUND`, `ROOM_NOT_JOINABLE`, `ROOM_FULL`, `ROOM_ID_EXHAUSTED`, `NICKNAME_INVALID`, and `SESSION_EXPIRED`.
- [x] Preserve the submitted room code and nickname where the UI needs them for correction or retry.
- [x] Add adapter tests for error codes and retryability.

### Acceptance criteria

- [x] Raw SDK messages, dependency details, and stack traces are never presented to players.
- [x] Retryability is derived from stable application codes rather than message text.
- [x] Create, join, and reconnect screens can branch on documented error codes.

## P0-4: Shared combat and position unit tests

Add deterministic unit coverage for `packages/shared/src/combat.ts` and related position validation.

### Position validation

- [ ] Reject non-finite coordinates.
- [ ] Accept the exact 0.75 m marker-exclusion boundary and reject positions inside it.
- [ ] Accept the exact arena-radius boundary and reject positions outside it.
- [ ] Accept the exact 1.5 m player-spacing boundary and reject positions below it.
- [ ] Verify correction data is finite and includes a valid direction, magnitude, and conflicting participant ID.

### Combat helpers

- [ ] Test `normalizeDirection` at the valid magnitude boundaries of 0.1 and 2.0 and outside them.
- [ ] Verify `resolveBoltAttack` ignores targets behind the attacker, outside range, or ineligible.
- [ ] Verify the nearest aligned target wins and equal-distance ties use stable participant-ID ordering.
- [ ] Verify a valid attack can miss without mutating combat state.
- [ ] Verify `applyDamage` consumes shield before HP, handles overflow, clamps values, and eliminates at exactly zero HP.
- [ ] Verify `standingsFor` orders by HP, then quiz score, then stable participant ID.

### Acceptance criteria

- [ ] The suite is deterministic and requires no device, wall-clock timing, or network access.
- [ ] Boundary behavior is asserted explicitly rather than covered only by broad happy-path cases.

## P0-5: WarRoom negative-path integration tests

Add direct assertions for the documented validation and error contract. Avoid duplicating payload definitions here; use [API_AND_REALTIME_SPEC.md](API_AND_REALTIME_SPEC.md) as the source of truth.

### Admission and identity

- [ ] Invalid or unsupported client protocol version.
- [ ] Nickname normalization, control-character rejection, and length limits.
- [ ] Thirteenth participant rejection and full-room behavior.
- [ ] Room not found and room not joinable.
- [ ] Deterministic duplicate-nickname suffixes.

### Command validation

- [ ] Payload-size, round-ID, role, command-deduplication, per-round-cap, and rate-limit failures.
- [ ] Stable structured error codes and details for each failure.

### Quiz

- [ ] Exact answer-deadline boundary.
- [ ] Invalid question ID and option ID.
- [ ] Semantic duplicate answer handling.
- [ ] Missing and disconnected-participant answers.
- [ ] Private answer results and public-state privacy.

### Localization and positioning

- [ ] Arena-radius, marker-exclusion, out-of-bounds, and minimum-spacing boundaries.
- [ ] Structured correction details for rejected positions.
- [ ] Position unlock and relock behavior.
- [ ] All battle-start blockers returned together.
- [ ] Quiz-only participants excluded from combat readiness blockers.

### Combat and reset

- [ ] Attacks before battle start and after battle end.
- [ ] Cooldown, invalid direction, invalid weapon, eliminated-attacker, and lost-localization failures.
- [ ] Valid misses and duplicate command IDs.
- [ ] Complete reset of round-scoped fields.
- [ ] Rejection of commands carrying an old round ID.
- [ ] Stable event sequence and round ordering.

## P0-6: Disconnect and expiry integration tests

- [ ] Participant reconnect within the 20-second grace period restores the same session.
- [ ] Pre-countdown timeout automatically excludes the participant from combat after P0-1 is implemented.
- [ ] Battle timeout eliminates the participant exactly once.
- [ ] Explicit participant leave follows the documented policy in every phase.
- [ ] Organizer timeout after 60 seconds before countdown closes the room.
- [ ] Organizer absence during the 20-second active-round grace period does not stop the match.
- [ ] Idle room expiry occurs after two hours.
- [ ] Server restart invalidates prior reconnect tokens.

## P0-7: Twelve-combatant backend rehearsal

The existing twelve-participant admission test excludes most participants from combat. Add a rehearsal that exercises an actual twelve-combatant battle.

### Required behavior

- [ ] Arrange twelve valid locked positions inside the 6 m arena while respecting marker exclusion and minimum spacing.
- [ ] Localize and ready all twelve combatants.
- [ ] Start the battle with all twelve included.
- [ ] Exercise the documented maximum raw attack rate while room patches run at 100 ms/10 Hz.
- [ ] Verify state validity, damage deduplication, event ordering, and completion without command timeouts.
- [ ] Run the deterministic rehearsal twice.

### Acceptance criteria

- [ ] Define a measurable pass threshold before treating the rehearsal as complete.
- [ ] Prefer fake-clock and bounded event-count assertions for CI; do not make CI depend on a flaky wall-clock-only threshold.
- [ ] Record any manual local performance measurement separately from deterministic correctness assertions.
- [ ] Treat the mixed-device physical rehearsal as a separate M1 integration gate, not as a substitute for this backend test.

## P0-8: Remove the obsolete HTTP server duplicate

`apps/server/src/httpServer.ts` and its dedicated test duplicate the operational endpoints already owned by the Colyseus application and return a different response shape.

- [x] Delete `apps/server/src/httpServer.ts` after confirming it is not used by production code.
- [x] Delete its obsolete dedicated test.
- [x] Retain the operational-route tests around the production Colyseus application configuration.

## P0 definition of done

- [ ] P0-1 through P0-8 are complete.
- [ ] `npm run typecheck --workspace @codexwars/shared` passes.
- [ ] `npm run test --workspace @codexwars/shared` passes.
- [ ] `npm run typecheck --workspace @codexwars/server` passes.
- [ ] `npm run test --workspace @codexwars/server` passes.
- [ ] Root `npm run typecheck` passes.
- [ ] Root `npm test` passes.
- [ ] The twelve-combatant backend rehearsal passes twice deterministically.
- [ ] P0 introduces no Firebase, database, account, or cloud-service dependency.
- [ ] Device M0/M1 validation is tracked as an external integration gate after backend completion.

## Deferred beyond P0

Do not mix the following work into the P0 backend completion unless the product specifications are deliberately revised:

- Firebase, Firebase Authentication, or another application database
- Persistent room recovery across server restarts
- Redis, shared Presence, or horizontal room-server scaling
- Hosted TLS/WSS, container deployment, production observability, and broader abuse hardening
- Authored quiz libraries, player accounts, history, analytics, and PostgreSQL persistence
- Fireball, loadouts, teams, tournaments, and other post-P0 game systems
- Minimap fallback, spectator mode, organizer moderation, and tracking-pause workflows
- Big-screen spectator presentation
