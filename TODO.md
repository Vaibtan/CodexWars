# CodexWars Backend TODO

**Status:** Complete
**Last reviewed:** 2026-07-16
**Scope:** Completion record for the P0 backend correctness, coverage, and release-readiness work.

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

The completed P0 gate passes 62 server tests, 19 shared-package tests, 15 mobile unit tests, 9 mobile native-identity tests, and strict TypeScript checks for every workspace. The checklist below records the implemented and verified closure of the original correctness, coverage, and readiness gaps.

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

- [x] In the lobby, an explicit participant leave removes the participant record.
- [x] During quiz, localization, or positioning, an explicit leave retains the round record, marks the participant disconnected, clears readiness and position, and sets `combatIncluded` to `false`.
- [x] During quiz, localization, or positioning, an unexpected disconnect retains the participant for the 20-second reconnect grace period.
- [x] When that pre-countdown grace period expires, automatically exclude the participant from combat and clear readiness and position.
- [x] During countdown or battle, retain the existing 20-second reconnect grace period for an unexpected disconnect.
- [x] When an active-round reconnect grace period expires, eliminate the participant exactly once and re-evaluate whether the round has a winner.
- [x] During countdown or battle, an explicit leave immediately eliminates the participant exactly once, re-evaluates round completion, and retains the record for standings.
- [x] Preserve the organizer policies: 60-second grace before countdown, 20-second grace during countdown or battle, and no organizer role transfer.

### Acceptance criteria

- [x] No disconnect or leave path can deadlock phase progression.
- [x] Each active-round departure produces at most one elimination and one corresponding event.
- [x] Reconnecting within the grace period restores the same authoritative participant record.
- [x] Final standings remain stable after disconnects and explicit leaves.
- [x] An explicit lobby leave does not leave a ghost participant.

## P0-2: Publish quiz scores only after quiz completion

`PlayerState.correctAnswers` is public synchronized state and must not expose a participant's running score while the quiz is in progress.

### Required behavior

- [x] Maintain the running correct-answer count in private server state.
- [x] Continue returning the participant's private running result through `quiz_answer_result` where required by the API contract.
- [x] Keep public `PlayerState.correctAnswers` at its initial or last finalized value during questions and reveals.
- [x] Publish the final correct-answer count and shield reward together when the complete quiz finishes.
- [x] Clear both private running state and public finalized state during round reset.

### Acceptance criteria

- [x] Public room state never exposes partial scores during question or reveal phases.
- [x] Each participant receives the correct private answer result and running total.
- [x] Quiz completion publishes the correct final score and shield reward.
- [x] Reconnects do not expose selected answers or another participant's partial score.

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

- [x] Reject non-finite coordinates.
- [x] Accept the exact 0.75 m marker-exclusion boundary and reject positions inside it.
- [x] Accept the exact arena-radius boundary and reject positions outside it.
- [x] Accept the exact 1.5 m player-spacing boundary and reject positions below it.
- [x] Verify correction data is finite and includes a valid direction, magnitude, and conflicting participant ID.

### Combat helpers

- [x] Test `normalizeDirection` at the valid magnitude boundaries of 0.1 and 2.0 and outside them.
- [x] Verify `resolveBoltAttack` ignores targets behind the attacker, outside range, or ineligible.
- [x] Verify the nearest aligned target wins and equal-distance ties use stable participant-ID ordering.
- [x] Verify a valid attack can miss without mutating combat state.
- [x] Verify `applyDamage` consumes shield before HP, handles overflow, clamps values, and eliminates at exactly zero HP.
- [x] Verify `standingsFor` orders by HP, then quiz score, then stable participant ID.

### Acceptance criteria

- [x] The suite is deterministic and requires no device, wall-clock timing, or network access.
- [x] Boundary behavior is asserted explicitly rather than covered only by broad happy-path cases.

## P0-5: WarRoom negative-path integration tests

Add direct assertions for the documented validation and error contract. Avoid duplicating payload definitions here; use [API_AND_REALTIME_SPEC.md](API_AND_REALTIME_SPEC.md) as the source of truth.

### Admission and identity

- [x] Invalid or unsupported client protocol version.
- [x] Nickname normalization, control-character rejection, and length limits.
- [x] Thirteenth participant rejection and full-room behavior.
- [x] Room not found and room not joinable.
- [x] Deterministic duplicate-nickname suffixes.

### Command validation

- [x] Payload-size, round-ID, role, command-deduplication, per-round-cap, and rate-limit failures.
- [x] Stable structured error codes and details for each failure.

### Quiz

- [x] Exact answer-deadline boundary.
- [x] Invalid question ID and option ID.
- [x] Semantic duplicate answer handling.
- [x] Missing and disconnected-participant answers.
- [x] Private answer results and public-state privacy.

### Localization and positioning

- [x] Arena-radius, marker-exclusion, out-of-bounds, and minimum-spacing boundaries.
- [x] Structured correction details for rejected positions.
- [x] Position unlock and relock behavior.
- [x] All battle-start blockers returned together.
- [x] Quiz-only participants excluded from combat readiness blockers.

### Combat and reset

- [x] Attacks before battle start and after battle end.
- [x] Cooldown, invalid direction, invalid weapon, eliminated-attacker, and lost-localization failures.
- [x] Valid misses and duplicate command IDs.
- [x] Complete reset of round-scoped fields.
- [x] Rejection of commands carrying an old round ID.
- [x] Stable event sequence and round ordering.

## P0-6: Disconnect and expiry integration tests

- [x] Participant reconnect within the 20-second grace period restores the same session.
- [x] Pre-countdown timeout automatically excludes the participant from combat after P0-1 is implemented.
- [x] Battle timeout eliminates the participant exactly once.
- [x] Explicit participant leave follows the documented policy in every phase.
- [x] Organizer timeout after 60 seconds before countdown closes the room.
- [x] Organizer absence during the 20-second active-round grace period does not stop the match.
- [x] Idle room expiry occurs after two hours.
- [x] Server restart invalidates prior reconnect tokens.

## P0-7: Twelve-combatant backend rehearsal

The existing twelve-participant admission test excludes most participants from combat. Add a rehearsal that exercises an actual twelve-combatant battle.

### Required behavior

- [x] Arrange twelve valid locked positions inside the 6 m arena while respecting marker exclusion and minimum spacing.
- [x] Localize and ready all twelve combatants.
- [x] Start the battle with all twelve included.
- [x] Exercise the documented maximum raw attack rate while room patches run at 100 ms/10 Hz.
- [x] Verify state validity, damage deduplication, event ordering, and completion without command timeouts.
- [x] Run the deterministic rehearsal twice.

### Acceptance criteria

- [x] The automated pass threshold is 12 accepted simultaneous attacks, 108 cooldown rejections, a 12-event ordered attack sequence, exact 34-event round completion, and identical results across two runs.
- [x] The rehearsal uses a fake clock and bounded event-count assertions; CI has no wall-clock performance threshold.
- [x] No manual performance result is represented as deterministic CI evidence.
- [x] The mixed-device physical rehearsal remains a separate M1 integration gate, not a substitute for this backend test.

## P0-8: Remove the obsolete HTTP server duplicate

`apps/server/src/httpServer.ts` and its dedicated test duplicate the operational endpoints already owned by the Colyseus application and return a different response shape.

- [x] Delete `apps/server/src/httpServer.ts` after confirming it is not used by production code.
- [x] Delete its obsolete dedicated test.
- [x] Retain the operational-route tests around the production Colyseus application configuration.

## P0 definition of done

- [x] P0-1 through P0-8 are complete.
- [x] `npm run typecheck --workspace @codexwars/shared` passes.
- [x] `npm run test --workspace @codexwars/shared` passes.
- [x] `npm run typecheck --workspace @codexwars/server` passes.
- [x] `npm run test --workspace @codexwars/server` passes.
- [x] Root `npm run typecheck` passes.
- [x] Root `npm test` passes.
- [x] The twelve-combatant backend rehearsal passes twice deterministically.
- [x] P0 introduces no Firebase, database, account, or cloud-service dependency.
- [x] Device M0/M1 validation is tracked as an external integration gate after backend completion.

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
