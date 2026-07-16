# CodexWars — Architecture Design

**Version:** 1.2
**Companions:** `PRD.md` v2.4 (what & why) · `BUILD_SPEC.md` v1.4 (stack, repo layout, build order) · `API_AND_REALTIME_SPEC.md` v1.2 (exact P0 interface contract)
**This document:** the structural and runtime design — components, deployment, critical sequences, state machines, and invariants. Diagrams here are the reference during implementation; if code and this doc disagree, fix one of them in the same commit.

---

## 1. Architecture at a glance

Three layers, one hard rule per boundary:

| Layer | Owns | Hard rule |
|---|---|---|
| **AR presentation** (`mobile/src/ar/`) | Marker tracking, coordinate conversion, rendering bundled GLBs/effects in camera space | Only place Viro is imported. Publishes plain 2D data; never touches the network. |
| **Game client** (`apps/mobile/src/{features,screens,components}`) | UI, local state, Colyseus connection | Never imports Viro types outside `src/ar`. Treats AR as a sensor behind the `ArSceneBridge` contract; only `features/warRoom/realtimeClient.ts` imports `@colyseus/sdk`. |
| **Authoritative server** (`server/`) | Rooms, phase machine, validation, combat, results | Never knows AR exists. Consumes marker-relative 2D coordinates as opaque numbers. |

All three compile against `packages/shared` (types, protocol, constants, pure game math). The math is written once and executed in two places: the server uses it authoritatively; the client uses the same functions for prediction (crosshair target highlight), which is why predicted and actual results almost always agree.

---

## 2. Deployment view

### Demo / development topology (M0–M2)

```mermaid
flowchart TB
    subgraph HOTSPOT["Phone hotspot or laptop hotspot (LAN, no internet needed)"]
        subgraph LAPTOP["Windows laptop"]
            SRV["Colyseus server (Node 22.23.1)<br/>in-memory state only"]
        end
        P1["Organizer phone<br/>(Android or iOS dev build)"]
        P2["Participant phone 1<br/>(Android or iOS)"]
        P3["Participant phone 2..12<br/>(mixed platform)"]
    end
    MARKER["Printed A4 marker on floor<br/>(shared coordinate origin — passive, no electronics)"]
    P1 <-->|WebSocket| SRV
    P2 <-->|WebSocket| SRV
    P3 <-->|WebSocket| SRV
    P1 -.camera.-> MARKER
    P2 -.camera.-> MARKER
    P3 -.camera.-> MARKER
```

Properties: no cloud services, no internet, one Wi-Fi hop between every phone and the server. The marker is the only "shared infrastructure" and it's a piece of paper.

### Product topology (M3+)
A single-node hosted pilot preserves the `WarRoom` and protocol interfaces, but deployment is not a URL-only change: it adds TLS/WSS termination, WebSocket-aware ingress, health checks, process supervision, observability, abuse throttling, and client/server compatibility policy. Horizontal scale adds shared Colyseus Presence/Driver, room placement, and durable product storage outside live room state. M3 begins with a dedicated hosted-architecture review.

---

## 3. Component view

```mermaid
flowchart TB
    subgraph MOBILE["apps/mobile"]
        subgraph AR["ar/ (Viro boundary)"]
            SESSION["ParticipantArenaArView + SharedArenaScene<br/>retained marker tracking and GLB rendering"]
            COORD["coordinates.ts<br/>pure marker-space math"]
        end
        subgraph CORE["app core"]
            APP["App.tsx<br/>screen and room lifecycle"]
            SCREENS["screens/<br/>participant and organizer overlays"]
            ROOMHOOK["useWarRoom.ts<br/>validated room snapshot subscription"]
            NET["features/warRoom/realtimeClient<br/>@colyseus/sdk adapter<br/>matchmake · validate · messages · reconnect"]
            HUD["components/<br/>crosshair, HP bars, fire buttons"]
        end
    end

    subgraph SERVER["apps/server"]
        CODES["roomId.ts<br/>unique 4-digit roomId allocation"]
        ROOM["rooms/war-room.ts<br/>lifecycle · phase machine · validation"]
        SCHEMA["rooms/state.ts<br/>Colyseus synced state"]
    end

    subgraph SHARED["packages/shared"]
        PROTO["protocol.ts"]
        CONST["constants.ts (all tunables)"]
        COMBAT["combat.ts<br/>position, attack, damage, standings"]
        QUIZ["quiz.ts<br/>bundled template and rewards"]
    end

    SESSION --> COORD
    SESSION -->|"marker pose and aim"| SCREENS
    SCREENS -->|"actors and phase"| SESSION
    APP --> SCREENS & ROOMHOOK
    SCREENS --> HUD & NET
    ROOMHOOK <--> NET
    NET <-->|"WebSocket"| ROOM
    ROOM --> SCHEMA & CODES
    ROOM -->|authoritative| COMBAT & QUIZ
    SCREENS -->|target highlight only| COMBAT
    SHARED -.types.- MOBILE & SERVER
```

Dependency direction is strictly downward into `shared`; `shared` imports nothing from anywhere (zero runtime deps — enforced in its `package.json`).

---

## 4. Runtime sequences (the five that matter)

### 4.1 Room creation and join bootstrap

Room creation/joining happens through Colyseus matchmaking before any in-room command can exist. The four-digit public code is the custom `roomId`, so there is no second code registry to keep consistent.

```mermaid
sequenceDiagram
    participant ORG as Organizer app
    participant MM as Colyseus matchmaker
    participant ROOM as WarRoom
    participant P as Participant app

    ORG->>MM: create room type "war" {organizerName}
    MM->>ROOM: construct + onCreate
    ROOM->>ROOM: allocate unique 4-digit roomId through Presence
    ROOM->>ROOM: bind creating client to organizer role
    MM-->>ORG: connected room + roomId + reconnectionToken
    ORG-->>ORG: display roomId as public code
    P->>MM: joinById(code) {displayName}
    MM->>ROOM: reserve/consume seat + onJoin
    ROOM->>ROOM: validate capacity; create participant record
    ROOM-->>P: connected room + initial state + reconnectionToken
```

Organizer/participant roles come only from this server-owned lifecycle. A client cannot promote itself with an in-room payload.

### 4.2 Localization and position lock

```mermaid
sequenceDiagram
    participant V as ar/ArenaSession (Viro)
    participant S as stores
    participant N as realtimeClient adapter
    participant SRV as WarRoom

    Note over V: participant on Marker-scan screen
    V->>V: ViroARImageMarker acquires marker → capture T_marker
    V->>S: ArSessionState = localized
    S->>N: localization_changed {state: "localized"}
    N->>SRV: forward
    SRV->>SRV: player.localized = true (synced state → organizer minimap)
    Note over V: participant walks to a spot, taps Lock
    V->>S: ArPose {position} (camera pose in marker space)
    S->>N: lock_position {x, z}
    N->>SRV: forward
    SRV->>SRV: validate: combatIncluded? outside marker exclusion?<br/>inside radius? ≥ MIN_SPACING from locked combat players?
    alt valid
        SRV-->>N: state sync: player.position set
    else invalid
        SRV-->>N: error {code, details: correction vector + distance}
        N-->>S: show directional guidance, stay unlocked
    end
```

### 4.3 Attack resolution (the core loop)

```mermaid
sequenceDiagram
    participant HUD as HUD (fire button)
    participant B as battleStore
    participant N as realtimeClient adapter
    participant SRV as WarRoom
    participant ALL as all clients

    Note over B: ar/ publishes ArPose at ~10Hz continuously
    HUD->>B: fire pressed
    B->>B: read latest aimDir; run shared resolveAttack for prediction
    Note over B: project camera forward onto X/Z; discard vertical pitch
    B->>N: attack command
    N->>SRV: forward
    SRV->>SRV: validate at server receipt: role/round/unseen command,<br/>phase=battle, now≥startsAt, alive, cooldown, charges, |dir|≈1
    SRV->>SRV: resolveAttack(attacker, dir, weapon, players)  ← shared/combat.ts
    SRV->>SRV: applyDamage: shield → HP → clamp → eliminated?
    SRV->>ALL: authoritative attack result + state patch
    opt target reached 0 HP
        SRV->>ALL: player_eliminated {playerId}
        SRV->>SRV: checkWinner → maybe battle_completed
    end
    ALL->>ALL: HUD update + AR effect (projectile/flash toward target position)
```

Latency budget: one client→server hop + broadcast on LAN ≈ 5–30 ms; the ≤250 ms responsiveness target (PRD §9) has an order-of-magnitude margin on the demo topology.

### 4.4 Battle start (synchronized countdown)

```mermaid
sequenceDiagram
    participant ORG as Organizer client
    participant SRV as WarRoom
    participant ALL as all clients

    ORG->>SRV: start_battle
    SRV->>SRV: check start invariant for every combat-included participant:<br/>connected ∧ localized ∧ quizCompleted ∧ position≠null ∧ ready
    alt invariant fails
        SRV-->>ORG: error {NOT_READY, blockers: [playerIds]}
    else ok
        SRV->>SRV: phase=countdown; startsAt = serverNow + COUNTDOWN_MS
        SRV->>ALL: state sync {phase, startsAt, serverNow}
        ALL->>ALL: render countdown from startsAt using calculated server-time offset
        SRV->>SRV: at startsAt: phase=battle; arm battle timer
    end
```

Clients never count down from a local "5"; they render `startsAt − (localNow + serverTimeOffset)`, so a phone that receives the sync late still agrees on the start instant.

### 4.5 Disconnect and reconnect

```mermaid
sequenceDiagram
    participant P as Participant phone
    participant SRV as WarRoom

    P--xSRV: transport drop (WiFi blip)
    SRV->>SRV: onDrop: player.connected=false, PlayerState retained
    alt phase = battle
        SRV->>SRV: start DISCONNECT_ELIMINATION_MS timer (20s)
    end
    alt reconnects in time (@colyseus/sdk auto-reconnection)
        P->>SRV: reconnect with session token
        SRV->>SRV: onReconnect: reattach to same PlayerState, connected=true
        SRV-->>P: full state sync (position, HP, charges intact)
        Note over P: if AR session survived, resume battle;<br/>else prompt marker re-scan (position is server-held, not lost)
    else timer expires during battle
        SRV->>SRV: eliminate player, broadcast player_eliminated
    end
```

Key property: **position, HP, and rewards live on the server**, so a phone reboot mid-session loses only the AR localization (recoverable by re-scanning the marker) — never the player's game state.

Organizer drops follow a different policy: before countdown, the phase stays unchanged and organizer-only commands are unavailable for 60 seconds; grace expiry closes the in-memory room. Once countdown or battle has started, authoritative timers/combat continue and only organizer controls are unavailable until reconnection.

---

## 5. State machines

### 5.1 Room phases (server-owned; the master clock of a session)

```mermaid
stateDiagram-v2
    [*] --> lobby: matchmaker creates WarRoom
    lobby --> quiz: organizer start_quiz
    quiz --> localization: final reveal completes
    localization --> positioning: arena configured ∧ all combat participants localized
    positioning --> countdown: start_battle ∧ start invariant holds
    countdown --> battle: startsAt reached
    battle --> results: one alive ∨ timer expired
    results --> lobby: organizer reset (rematch, players retained)
    results --> [*]: room expiry
```

The exact inbound-command validation order and error behavior are defined in `API_AND_REALTIME_SPEC.md` §6. Invalid commands never mutate state.

### 5.2 AR session (client-owned, per phone)

```mermaid
stateDiagram-v2
    [*] --> initializing: AR screen mounts
    initializing --> searching: Viro session ready
    searching --> localized: marker acquired (T_marker captured)
    localized --> degraded: marker not visible, fresh inertial pose continues
    degraded --> localized: marker reacquired
    degraded --> tracking_lost: pose becomes stale/unavailable
    localized --> tracking_lost: world tracking fails
    tracking_lost --> searching: user taps re-scan
    tracking_lost --> localized: marker/world tracking recovers
    localized --> [*]: AR screen unmounts (camera off — thermal rule)
    degraded --> [*]: AR screen unmounts
    tracking_lost --> [*]: AR screen unmounts
```

The server receives only coarse `searching` / `localized` / `lost` state. The AR module separately owns pose quality and freshness. Before countdown, `lost` clears readiness. During P0 battle, `degraded` may keep firing while timestamped inertial poses remain fresh; `tracking_lost` retains the locked server position but disables firing locally, shows a re-scan prompt, and does not pause the shared match. A frozen last-known aim is never sent.

### 5.3 Player lifecycle (server-owned, per participant)

```
joined → quiz_done → localized → positioned → ready ──battle──► alive ─┬─► eliminated → P0 eliminated overlay
   quiz_only ─────────────────────────────────────────────────────────────┘
   (any state) ⇄ disconnected(grace) — state retained, timers per §4.4  └─► winner
```

---

## 6. Data & coordinate architecture

### 6.1 Coordinate spaces
1. **Device-local AR space** — each phone's private Viro world; arbitrary origin; never leaves `ar/`.
2. **Marker space** — the shared 2D floor frame: origin at the printed marker's center, axes from its orientation (asymmetric marker ⇒ unambiguous). All network coordinates are marker-space `(x, z)` metres. Conversions (`coordinates.ts`, from BUILD_SPEC §9.3): position lock = `inverse(T_marker) × cameraPose`; rendering = `T_marker × [x, AVATAR_HEIGHT_M, z]`.
3. **Server space** — identical to marker space; the server just does 2D geometry on the numbers.

Y is discarded at the `ar/` boundary. There is no coordinate translation on the server, no per-device calibration data to sync, and no shared state beyond what Colyseus already syncs.

### 6.2 State ownership (single-writer rule)

| Data | Written by | Read by |
|---|---|---|
| Role, phase, `roundId`, `eventSequence`, `startsAt`, `serverNow`, combat inclusion, positions, HP/shield/charges, eliminations, winner | **Server only** | all clients via state sync |
| Localization status, ready flag, quiz answers, attack commands | Owning client (as *requests*) | server validates, then owns the result |
| Combat inclusion | Organizer (as a request) | server validates, then owns the result |
| Timestamped live aim pose, pose quality/freshness, predicted target, effect animations | Owning client only | never continuously networked (fresh aim ships only inside discrete `attack` messages) |

This is why bandwidth stays trivial: continuous data (aim at 10 Hz) never crosses the network; only button presses and server verdicts do.

---

## 7. Cross-cutting invariants

Checked in code review and, where possible, by tests:

1. **I-1** No import of `@reactvision/react-viro` outside `apps/mobile/src/ar/` (lint rule).
2. **I-2** No import of anything from `apps/` inside `packages/shared`; `shared` has zero runtime dependencies.
3. **I-3** Every gameplay number lives in `shared/constants.ts` — no magic numbers in room or component code.
4. **I-4** The server never reads `predictedTargetId` for resolution (diagnostics logging only).
5. **I-5** Every client→server command handler: phase gate → role/authority check → payload validation → gameplay invariant validation → state mutation → sync/broadcast, in that order.
6. **I-6** All state mutations happen on the server inside `WarRoom`; clients render synced state and local prediction, never locally-mutated authority.
7. **I-7** AR camera is active only on marker-scan, position-lock, and battle screens (thermal budget, PRD D4).
8. **I-8** P0 start gating applies only to `combatIncluded` players; a quiz-only player has no position and cannot block battle start.
9. **I-9** P0 attack resolution uses server receipt time; client clocks never decide combat order.
10. **I-10** The organizer is non-combat in P0, does not consume participant capacity, and organizer commands require the server-bound role.
11. **I-11** Every combat command/result carries `roundId`; commands are deduplicated by `commandId`, and clients apply authoritative events once in `eventSequence` order.
12. **I-12** No attack is emitted from a pose older than `AIM.POSE_STALE_MS`; the locked server position may survive tracking loss, but a frozen aim may not.

---

## 8. Extension seams (how M2+/product features attach without surgery)

- **Minimap fallback mode (P1):** a second implementation of the `ArPose` producer — positions from organizer assignment and aim from gyro heading — plus explicit `playMode`, assignment, calibration, and readiness fields in the protocol/server state. The battle screen swaps the camera view for a top-down canvas; combat resolution remains unchanged.
- **Big-screen spectator view (P2):** a new read-only Colyseus client (web page on the laptop/projector) consuming the same state sync; the server adds an explicitly authorized `spectator` join path but combat/room rules remain unchanged.
- **Loadout economy (P2):** replaces `rewards.ts` mapping + adds a shop screen between quiz and localization; combat layer unchanged.
- **Teams/tournaments (P2):** additional fields on `PlayerState`/`RoomState` + winner logic variants in `combat.ts`; the phase machine gains no new states until tournaments (which compose rooms rather than complicate one).
- **Unity/native AR rewrite (contingency):** replaces `apps/mobile` only; protocol and server are engine-agnostic by construction.
