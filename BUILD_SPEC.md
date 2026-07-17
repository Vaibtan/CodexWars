# CodexWars — Build Specification

**Version:** 1.6
**Status:** Active build contract
**Last updated:** 2026-07-16

This document owns dependency pins, repository boundaries, local development, verification commands, and milestone gates. Product rules live in `PRD.md`; runtime ownership lives in `ARCHITECTURE.md`; the wire contract lives in `API_AND_REALTIME_SPEC.md`; marker and GLB rules live in `docs/AR_IMPLEMENTATION_SPEC.md`.

## 1. Build principles

1. Use the committed npm lockfile and exact versions for load-bearing packages.
2. Keep live room state in one authoritative Colyseus `WarRoom`; there is no Firebase, database, or account dependency, and the curated fallback completes a round without internet access.
3. Keep server game logic platform-neutral. The server receives only validated 2D positions and attack directions.
4. Keep every Viro import under `apps/mobile/src/ar/`.
5. Keep the Colyseus SDK behind `apps/mobile/src/features/warRoom/realtimeClient.ts`; screens send typed intents and consume validated snapshots.
6. Verify shared/server behavior without devices, then verify AR behavior on physical Android and iPhone devices.

## 2. Pinned toolchain

| Package | Version | Purpose |
|---|---:|---|
| Node.js | `22.23.1` | Runtime and tooling; pinned by `.nvmrc` and root `engines` |
| npm | `>=10` | Workspace package manager |
| TypeScript | `5.9.3` | Strict compiler across all workspaces |
| Expo | `54.0.36` | Mobile framework and development builds |
| React | `19.1.0` | Mobile UI runtime |
| React Native | `0.81.5` | Native runtime |
| `@types/react` | `19.1.10` | JSX and React types |
| `@reactvision/react-viro` | `2.53.1` | ARKit/ARCore rendering |
| `expo-dev-client` | `6.0.21` | Native development client; Expo Go is unsupported |
| `@colyseus/core` | `0.17.44` | Authoritative room server without unused auth/playground bundles |
| `@colyseus/schema` | `4.0.27` | Synchronized room state |
| `@colyseus/ws-transport` | `0.17.13` | Server WebSocket transport |
| `@colyseus/sdk` | `0.17.43` | Mobile realtime client |
| `@colyseus/testing` | `0.17.11` | Server integration tests |
| `ai` | `6.0.228` | Server-only structured generation and tool orchestration |
| `@ai-sdk/openai` | `3.0.85` | Server-only OpenAI Responses provider compatible with AI SDK 6 |
| `zod` | `4.1.12` | Runtime schemas for generated content and provider output |
| Vitest | `4.1.10` | Shared, mobile-adapter, and server tests |

Do not add Firebase packages or restore direct frontend database writes. A future durable product store requires a separate architecture decision and must not become live-room authority.

## 3. Repository layout

```text
apps/
  mobile/
    App.tsx
    src/ar/                         # only Viro import boundary
    src/features/warRoom/           # Colyseus adapter, hook, mobile session types
    src/screens/                    # presentation and navigation targets
  server/
    src/quiz/                       # deep preparation module, validation, provider adapter
    src/config.ts                   # typed environment configuration
    src/rooms/war-room.ts           # authority, phase machine, private state
    src/rooms/state.ts              # synchronized Schema allow-list
    src/rooms/room-id.ts            # four-digit room allocation
    test/                           # public-client integration tests
packages/
  shared/
    src/constants.ts                # P0 tunables and allow-lists
    src/combat.ts                   # 2D position/attack/result rules
    src/protocol.ts                 # commands, events, projections, runtime guards
    src/quiz.ts                     # curated fallback, quiz validation, shield mapping
    src/types.ts                    # cross-platform domain types
assets/characters/runtime/          # bundled GLB variants
docs/                               # supporting specifications and test procedures
```

There is one combat implementation and one realtime protocol. Do not introduce a parallel client-owned reducer, alternate room state, or duplicate API specification.

## 4. Local development

From the repository root:

```bash
nvm use
npm install
npm run server
```

In a second terminal:

```bash
npm run mobile
```

The server listens on `PORT` (default `4000`). The mobile app reads `EXPO_PUBLIC_REALTIME_SERVER_URL`.

- Physical phone: use the development machine's LAN address, for example `http://192.168.1.10:4000`.
- Android emulator: use `http://10.0.2.2:4000`.
- iOS simulator: `http://127.0.0.1:4000` can reach the host.

The phone and server must share a network, and the host firewall must allow the server port. Never place credentials in an `EXPO_PUBLIC_*` variable.

## 5. Native build rules

- Expo Go cannot load Viro. Use the installed development client.
- Build Android locally with `npm run android --workspace @codexwars/mobile` or an EAS development profile.
- Build iOS through EAS from Windows and test on a physical ARKit-capable iPhone.
- Rebuild the native client after changing Expo plugins, native dependencies, package IDs, or Viro configuration.
- Do not edit generated `android/` or `ios/` directories; this project uses Expo managed/CNG configuration.

## 6. Runtime boundaries

### Shared

- Owns protocol guards, public projection types, constants, curated fallback content, quiz validation, shield mapping, and pure 2D combat.
- Has no React Native, Viro, Colyseus server, storage, or cloud dependency.

### Server

- Owns admission, role/player bindings, room phases, clocks, quiz preparation/approval, provider isolation, evidence/review privacy, answer privacy, cost controls, position validation, cooldowns, damage, elimination, results, reset, and reconnect policy.
- Stores live and private state in memory for the room lifetime.
- Publishes only the Schema allow-list validated by `isPublicRoomStateProjection`.
- Reads `OPENAI_API_KEY` only in the server process. Missing configuration reports `fallback_only` readiness and never prevents startup.

### Mobile

- Creates/joins rooms through the Colyseus SDK and obtains server-bound identity through the `request_session`/`session_ready` handshake.
- Validates every full state projection and private event before exposing it to screens.
- Sends typed intents with a generated `commandId` and current `roundId`; UI actions await correlated acknowledgement/error.
- Uses SDK automatic reconnection for transient drops and explicitly leaves only on user exit.

### AR

- Produces marker-relative position and fresh floor-projected aim.
- Renders synchronized character choice, position, HP, shield, and elimination state.
- Never resolves hits or mutates authoritative game state.

## 7. Verification

Run from the root before handoff:

```bash
npm run typecheck
npm test
npm run test:bundle:android --workspace @codexwars/mobile
npx expo-doctor apps/mobile
```

Minimum device gate for AR changes:

1. Install the same commit's development build on one physical Android and one physical iPhone.
2. Verify marker acquisition, cross-device origin agreement, tracking-loss behavior, and all enabled GLB variants.
3. Run a complete mixed-platform round twice without restarting the server.

## 8. Milestone gates

### M0 — marker colocation

Pass the measurements in `docs/AR_IMPLEMENTATION_SPEC.md` on Android and iPhone. The bundled 180 mm marker, marker-space pose adapter, fresh camera-forward aim, and retained participant navigator are implemented; the gate remains open until the physical cross-device results are recorded.

### M1 — P0 vertical slice

Create → join → prepare/approve generated or fallback quiz → shield result → character cosmetic → marker localization → safe position lock → ready → 60-second Bolt battle → standings → reset. Exit only after generated-success and fallback-failure rehearsals pass and the mixed-platform device flow succeeds twice.

### M2 — hardening

Minimap fallback, eliminated-player spectator presentation, richer tracking recovery, organizer moderation, and operational polish. Fireball or other loadout mechanics require an explicit shared protocol/game-design change; they are not latent P0 code.
