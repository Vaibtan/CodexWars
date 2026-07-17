# CodexWars — Architecture Design

**Version:** 1.4
**Last updated:** 2026-07-16
**Companions:** `PRD.md` v2.7 (what and why) · `BUILD_SPEC.md` v1.6 (stack, repository, verification) · `API_AND_REALTIME_SPEC.md` v2.0 (exact interface contract) · `docs/AR_IMPLEMENTATION_SPEC.md` (marker/device contract)
**This document:** the structural and runtime design — components, deployment, critical sequences, state machines, and invariants. Diagrams here are the reference during implementation; if code and this doc disagree, fix one of them in the same commit.

---

## 1. Architecture at a glance

Three layers, one hard rule per boundary:

| Layer | Owns | Hard rule |
|---|---|---|
| **AR presentation** (`apps/mobile/src/ar/`) | Marker tracking, coordinate conversion, rendering bundled GLBs/effects in camera space | Only place Viro is imported. Publishes plain 2D data; never touches the network. |
| **Game client** (`apps/mobile/src/{features,screens,components}`) | UI, local state, Colyseus connection | Never imports Viro types outside `src/ar`. Treats AR as a sensor behind the `ArSceneBridge` contract; only `features/warRoom/realtimeClient.ts` imports `@colyseus/sdk`. |
| **Authoritative server** (`apps/server/`) | Rooms, phase machine, validation, combat, results | Never knows AR exists. Consumes marker-relative 2D coordinates as opaque numbers. |

All three compile against `packages/shared` (types, protocol, constants, pure game math). The math is written once and executed in two places: the server uses it authoritatively; the client uses the same functions for prediction (crosshair target highlight), which is why predicted and actual results almost always agree.

---

## 2. Deployment view

### Demo / hosted-pilot topology (M0–M2)

```mermaid
flowchart TB
    subgraph HOTSPOT["Shared LAN or hosted WebSocket endpoint"]
        subgraph LAPTOP["Windows laptop"]
            SRV["Colyseus server (Node 22.23.1)<br/>in-memory state only"]
        end
        P1["Organizer phone<br/>(Android or iOS dev build)"]
        P2["Participant phone 1<br/>(Android or iOS)"]
        P3["Participant phone 2..12<br/>(mixed platform)"]
    end
    MARKER["Printed A4 marker on floor<br/>(shared coordinate origin — passive, no electronics)"]
    OPENAI["OpenAI Responses API<br/>optional quiz preparation only"]
    P1 <-->|WebSocket| SRV
    P2 <-->|WebSocket| SRV
    P3 <-->|WebSocket| SRV
    SRV -.->|"prepare before gameplay"| OPENAI
    P1 -.camera.-> MARKER
    P2 -.camera.-> MARKER
    P3 -.camera.-> MARKER
```

Properties: one authoritative Node process owns every live room. OpenAI is an optional preparation dependency and is never contacted after a quiz template is frozen. Without an API key, internet, budget, or valid provider result, the server selects the bundled fallback and the same gameplay path completes. Phones communicate only with Colyseus and never receive provider credentials.

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
        PREP["quiz/QuizPreparation<br/>generation · grounding · review · fallback"]
        MODEL["quiz/OpenAI adapter<br/>AI SDK + Responses web search"]
        CONFIG["config.ts<br/>typed limits · capability · secrets"]
    end

    subgraph SHARED["packages/shared"]
        PROTO["protocol.ts"]
        CONST["constants.ts (all tunables)"]
        COMBAT["combat.ts<br/>position, attack, damage, standings"]
        QUIZ["quiz.ts<br/>curated fallback, validation, rewards"]
    end

    SESSION --> COORD
    SESSION -->|"marker pose and aim"| SCREENS
    SCREENS -->|"actors and phase"| SESSION
    APP --> SCREENS & ROOMHOOK
    SCREENS --> HUD & NET
    ROOMHOOK <--> NET
    NET <-->|"WebSocket"| ROOM
    ROOM --> SCHEMA & CODES & PREP
    PREP --> MODEL & QUIZ & CONFIG
    ROOM -->|authoritative| COMBAT
    SCREENS -->|target highlight only| COMBAT
    SHARED -.types.- MOBILE & SERVER
```

`WarRoom` depends only on the `QuizPreparation.prepare(request, signal)` interface. Provider types, web-search orchestration, retries, evidence policy, review, budgets, and fallback selection remain inside `apps/server/src/quiz/`. `QuizRun` consumes an immutable validated `QuizTemplate` and performs no external calls. Dependency direction remains downward into `shared`; `shared` imports nothing from `apps`.

---

## 4. Runtime sequences

### 4.0 Quiz preparation and approval

```mermaid
sequenceDiagram
    participant ORG as Organizer app
    participant ROOM as WarRoom
    participant PREP as QuizPreparation
    participant MODEL as QuizModelPort

    ORG->>ROOM: configure_quiz (bounded enums)
    ORG->>ROOM: prepare_quiz
    ROOM-->>ORG: command_accepted
    ROOM->>PREP: prepare(request, AbortSignal)
    alt generation enabled and budget available
        PREP->>MODEL: discover grounded evidence with web search
        MODEL-->>PREP: evidence brief + provider sources
        PREP->>MODEL: generate bounded candidate buffer using source IDs
        MODEL-->>PREP: structured candidates
        PREP->>MODEL: structured semantic review
        MODEL-->>PREP: per-question review results
        PREP->>PREP: select exactly ten approved questions or fallback
        PREP-->>ROOM: validated generated template
        ROOM-->>ORG: private quiz_prepared preview
        ORG->>ROOM: approve_quiz
    else disabled, failed, invalid, timed out, or over budget
        PREP-->>ROOM: validated curated fallback
    end
    ROOM->>ROOM: freeze immutable template
    ORG->>ROOM: start_quiz
```

Every request is bound to `roomId`, `roundId`, and a server preparation ID. Reset, disposal, cancellation, or a newer request aborts the old work; late completions fail the identity check and cannot mutate the room. Generated templates require organizer approval. The human-reviewed fallback is immediately startable and exposes only `fallback_ready` in public state.

### 4.1 Room creation and join bootstrap

Room creation/joining happens through Colyseus matchmaking before any in-room command can exist. The four-digit public code is the custom `roomId`, so there is no second code registry to keep consistent.

```mermaid
sequenceDiagram
    participant ORG as Organizer app
    participant MM as Colyseus matchmaker
    participant ROOM as WarRoom
    participant P as Participant app

    ORG->>MM: create room type "war" {protocolVersion, displayName}
    MM->>ROOM: construct + onCreate
    ROOM->>ROOM: allocate unique 4-digit roomId through Presence
    ROOM->>ROOM: bind creating client to organizer role
    MM-->>ORG: connected room + roomId + reconnectionToken
    ORG-->>ORG: display roomId as public code
    P->>MM: joinById(code) {protocolVersion, displayName}
    MM->>ROOM: reserve/consume seat + onJoin
    ROOM->>ROOM: validate capacity; create participant record
    ROOM-->>P: connected room + initial state + reconnectionToken
```

Organizer/participant roles come only from this server-owned lifecycle. A client cannot promote itself with an in-room payload.

### 4.2 Localization and position lock

```mermaid
sequenceDiagram
    participant V as SharedArenaScene (Viro)
    participant S as ParticipantArenaScreen
    participant N as realtimeClient adapter
    participant SRV as WarRoom

    Note over V: participant on Marker-scan screen
    V->>V: ViroARImageMarker acquires marker → capture T_marker
    V->>S: markerTracking = tracked/degraded
    S->>N: localization_changed {state: "localized"}
    N->>SRV: forward
    SRV->>SRV: player.localization = "localized" (synced state)
    Note over V: participant walks to a spot, taps Lock
    V->>S: MarkerSpacePose {position, direction, capturedAt}
    S->>N: lock_position {x, z}
    N->>SRV: forward
    SRV->>SRV: validate: combatIncluded? outside marker exclusion?<br/>inside radius? ≥ MIN_SPACING from locked combat players?
    alt valid
        SRV-->>N: state sync: positionX/Z + positionLocked
    else invalid
        SRV-->>N: error {code, details: correction vector + distance}
        N-->>S: show directional guidance, stay unlocked
    end
```

### 4.3 Attack resolution (the core loop)

```mermaid
sequenceDiagram
    participant HUD as HUD (fire button)
    participant B as ParticipantBattleScreen
    participant N as realtimeClient adapter
    participant SRV as WarRoom
    participant ALL as all clients

    Note over B: SharedArenaScene publishes marker-space pose locally at ≤10Hz
    HUD->>B: fire pressed
    B->>B: require fresh aim; run shared resolveBoltAttack for highlight only
    Note over B: project camera forward onto X/Z; discard vertical pitch
    B->>N: attack command
    N->>SRV: forward
    SRV->>SRV: validate at server receipt: role/round/unseen command,<br/>phase=battle, now≥startsAt, alive, cooldown, charges, |dir|≈1
    SRV->>SRV: resolveBoltAttack(attacker, players, dir) ← shared/combat.ts
    SRV->>SRV: applyDamage: shield → HP → clamp → eliminated?
    SRV->>ALL: authoritative attack result + state patch
    opt target reached 0 HP
        SRV->>ALL: player_eliminated {playerId}
        SRV->>SRV: completeIfLastAlive → maybe battle_completed
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
        SRV-->>ORG: server_error {code: BATTLE_START_BLOCKED, details: {blockers}}
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
    SRV->>SRV: start 20-second phase-aware reconnect timer
    alt reconnects in time (@colyseus/sdk auto-reconnection)
        P->>SRV: reconnect with session token
        SRV->>SRV: onReconnect: reattach to same PlayerState, connected=true
        SRV-->>P: full state sync (position, HP, charges intact)
        Note over P: if AR session survived, resume battle;<br/>else prompt marker re-scan (position is server-held, not lost)
    else timer expires before countdown
        SRV->>SRV: exclude from combat; clear readiness and position
    else timer expires during countdown/battle
        SRV->>SRV: eliminate once; evaluate winner; broadcast player_eliminated
    end
```

Key property: **position, HP, and rewards live on the server**, so a brief transport drop does not erase game state. If the AR session no longer has usable localization after reconnect, the participant must re-scan the marker before firing.

An explicit leave is not a reconnectable transport drop. It removes the participant in the lobby/results, excludes them immediately before countdown, or eliminates them immediately during countdown/battle.

Organizer drops follow a different policy: before countdown, the phase stays unchanged and organizer-only commands are unavailable for a 60-second reconnect grace; expiry closes the in-memory room. During countdown/battle the organizer has the same 20-second transport reconnect window as a participant, but expiry does not interrupt the authoritative match and never transfers organizer authority.

---

## 5. State machines

### 5.1 Room phases (server-owned; the master clock of a session)

```mermaid
stateDiagram-v2
    [*] --> lobby: matchmaker creates WarRoom
    lobby --> lobby: configure / prepare / approve quiz
    lobby --> quiz: organizer start_quiz with frozen template
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
    localized --> degraded: anchor reports limited/last-known tracking
    degraded --> localized: marker reacquired
    degraded --> tracking_lost: pose becomes stale/unavailable
    localized --> tracking_lost: world tracking fails
    tracking_lost --> searching: user taps re-scan
    tracking_lost --> localized: marker/world tracking recovers
    localized --> [*]: AR screen unmounts (camera off — thermal rule)
    degraded --> [*]: AR screen unmounts
    tracking_lost --> [*]: AR screen unmounts
```

The server receives only coarse `searching` / `localized` / `lost` state. The mobile bridge maps both tracked and degraded anchors to `localized`; it maps searching, marker removal, or unavailable world tracking to `lost`. Before countdown, `lost` clears readiness. During P0 battle, degraded tracking may keep firing only while timestamped marker-relative poses remain fresh. Lost/stale tracking retains the locked server position but disables firing, shows a re-scan prompt, and does not pause the shared match. A frozen last-known aim is never sent.

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
2. **Marker space** — the shared 2D floor frame: origin at the printed marker's center, axes from its orientation (asymmetric marker ⇒ unambiguous). All network coordinates are marker-space `(x, z)` metres. `apps/mobile/src/ar/coordinates.ts` computes position lock as `inverse(T_marker) × cameraPose`; `SharedArenaScene` renders actors as marker children at `[positionX, yOffset, positionZ]`.
3. **Server space** — identical to marker space; the server just does 2D geometry on the numbers.

Y is discarded at the `ar/` boundary. There is no coordinate translation on the server, no per-device calibration data to sync, and no shared state beyond what Colyseus already syncs.

### 6.2 State ownership (single-writer rule)

| Data | Written by | Read by |
|---|---|---|
| Role, phase, `roundId`, `eventSequence`, `startsAt`, `serverNow`, combat inclusion, positions, HP/shield/charges, eliminations, winner | **Server only** | all clients via state sync |
| Localization status, ready flag, quiz answers, attack commands | Owning client (as *requests*) | server validates, then owns the result |
| Combat inclusion | Organizer (as a request) | server validates, then owns the result |
| Quiz configuration, preparation, approval, cancellation | Organizer (as bounded requests) | server prepares and freezes the result; provider output is never authority until validated |
| Answer keys, evidence, review results, provider usage | **Server-private** | organizer receives only the approved private preview/source surface; participants receive each active question and post-close reveal |
| Timestamped live aim pose, pose quality/freshness, predicted target, effect animations | Owning client only | never continuously networked (fresh aim ships only inside discrete `attack` messages) |

This is why bandwidth stays trivial: continuous data (aim at 10 Hz) never crosses the network; only button presses and server verdicts do.

---

## 7. Cross-cutting invariants

Checked in code review and, where possible, by tests:

1. **I-1** No import of `@reactvision/react-viro` outside `apps/mobile/src/ar/` (source scan and native-identity regression tests).
2. **I-2** No import of anything from `apps/` inside `packages/shared`; `shared` has zero runtime dependencies.
3. **I-3** Every gameplay number lives in `shared/constants.ts` — no magic numbers in room or component code.
4. **I-4** The server never reads `predictedTargetId` for resolution (diagnostics logging only).
5. **I-5** Every client→server command follows the implemented validation order: exact payload parse → bound session lookup → round/dedup/rate checks → role check → phase/domain invariants → one mutation → acknowledgement/event.
6. **I-6** All state mutations happen on the server inside `WarRoom`; clients render synced state and local prediction, never locally-mutated authority.
7. **I-7** AR camera is active only on marker-scan, position-lock, and battle screens (thermal budget, PRD D4).
8. **I-8** P0 start gating applies only to `combatIncluded` players; a quiz-only player has no position and cannot block battle start.
9. **I-9** P0 attack resolution uses server receipt time; client clocks never decide combat order.
10. **I-10** The organizer is non-combat in P0, does not consume participant capacity, and organizer commands require the server-bound role.
11. **I-11** Every combat command/result carries `roundId`; commands are deduplicated by `commandId`, and clients apply authoritative events once in `eventSequence` order.
12. **I-12** No attack is emitted from a pose older than `AIM_POSE_STALE_MS`; the locked server position may survive tracking loss, but a frozen aim may not.
13. **I-13** No provider call occurs after `start_quiz`; all participants play one frozen template and identical scoring rules.
14. **I-14** OpenAI types, credentials, prompts, evidence, and retry policy remain inside the server quiz-preparation boundary.
15. **I-15** Missing/failed/exhausted generation degrades to the curated fallback and never changes server readiness or gameplay semantics.

---

## 8. Extension seams (how M2+/product features attach without surgery)

- **Minimap fallback mode (P1):** a second implementation of the `ArPose` producer — positions from organizer assignment and aim from gyro heading — plus explicit `playMode`, assignment, calibration, and readiness fields in the protocol/server state. The battle screen swaps the camera view for a top-down canvas; combat resolution remains unchanged.
- **Big-screen spectator view (P2):** a new read-only Colyseus client (web page on the laptop/projector) consuming the same state sync; the server adds an explicitly authorized `spectator` join path but combat/room rules remain unchanged.
- **Loadout economy (P2):** replaces the shield-band mapping in `packages/shared/src/quiz.ts` and adds a shop screen between quiz and localization; combat interfaces change only when new weapons/abilities are explicitly designed.
- **Teams/tournaments (P2):** additional fields on `PlayerState`/`RoomState` + winner logic variants in `combat.ts`; the phase machine gains no new states until tournaments (which compose rooms rather than complicate one).
- **Unity/native AR rewrite (contingency):** replaces `apps/mobile` only; protocol and server are engine-agnostic by construction.
