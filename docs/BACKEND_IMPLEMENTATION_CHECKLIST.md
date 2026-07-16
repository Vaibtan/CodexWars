# CodexWars P0 Backend Checklist

**Status:** Implemented
**Scope:** Authoritative in-memory Colyseus backend
**Last verified:** 2026-07-16

This is the implementation index for the backend work derived from `PRD.md`, `BUILD_SPEC.md`, `ARCHITECTURE.md`, and `API_AND_REALTIME_SPEC.md`. The original ticket files were removed after completion so their stale status and duplicated acceptance text could not compete with the active specifications.

| Slice | Status | Primary evidence |
|---|---|---|
| Boot server and bounded operational HTTP | complete | `apps/server/src/app.config.ts`, `apps/server/src/operational.ts`, `apps/server/test/room-admission.test.ts` |
| Create/join four-digit nickname-only rooms | complete | `apps/server/src/rooms/room-id.ts`, `WarRoom.onAuth/onJoin`, admission tests |
| Bind organizer/player identity and restore sessions | complete | private session maps, `request_session` handshake, drop/reconnect integration tests |
| Run bundled ten-question quiz and shield mapping | complete | `packages/shared/src/quiz.ts`, timer transitions, privacy/protocol tests |
| Select validated cosmetic character/color | complete | shared allow-lists and parser, synchronized player fields, cosmetic invariance test |
| Configure arena and lock safe positions | complete | `validatePosition`, localization/position handlers, boundary/spacing tests |
| Start countdown and resolve Bolt attacks | complete | `packages/shared/src/combat.ts`, authoritative cooldown/damage tests |
| Complete battle and reset round | complete | deterministic standings, timer/last-alive completion, reset integration test |
| Handle participant/organizer disconnect policy | complete | `onDrop`, `onReconnect`, grace timers, reconnect tests |
| Enforce privacy, validation, deduplication, and rate limits | complete | exact runtime guards, projection allow-list, redacted-log and abuse tests |
| Rehearse a 12-participant backend round | complete | deterministic two-run rehearsal in `room-admission.test.ts` |

## Verification

Run from the repository root:

```bash
npm run typecheck --workspace @codexwars/shared
npm run test --workspace @codexwars/shared
npm run typecheck --workspace @codexwars/server
npm run test --workspace @codexwars/server
```

Backend completion does not imply AR/device completion. The marker-space M0 and mixed Android/iPhone M1 gates remain in `BUILD_SPEC.md` and `docs/AR_IMPLEMENTATION_SPEC.md`.
