# CodexWars — Product Requirements Document

**Version:** 2.5
**Status:** Approved product direction — exact implementation contracts live in `BUILD_SPEC.md`, `ARCHITECTURE.md`, `API_AND_REALTIME_SPEC.md`, and `docs/AR_IMPLEMENTATION_SPEC.md`; archived documents are historical only
**Horizons:** Hackathon demo first → evolve into a real product
**Primary platforms:** Android and iOS (both required for P0; iOS iterates through EAS cloud development builds and is rehearsed through TestFlight on physical iPhones)
**Last updated:** 2026-07-16

---

## 1. Vision

CodexWars turns the end of a workshop or classroom quiz into a shared, physical, memorable moment: participants earn battle powers by answering questions correctly, then stand in a real-world arena and battle each other through their phone cameras in augmented reality.

Think **Kahoot meets laser tag** — the quiz is the learning activity, the AR battle is the reward that makes correct answers feel immediately meaningful.

---

## 2. Decision log — what changed from v1 and why

These decisions were made after researching the July 2026 AR landscape and the history of comparable products. They are settled unless new evidence appears.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Marker-based colocation replaces ARCore Cloud Anchors** as the shared-origin mechanism. A printed image marker on the floor is the arena origin; every phone scans it. | The hosted spatial-anchor market collapsed in 2024–2026 (Azure Spatial Anchors retired Nov 2024; Niantic Lightship Shared AR shut down May 2026; 8th Wall hosted service ended Feb 2026). Google Cloud Anchors survives but is in maintenance mode. Marker colocation needs no third-party spatial cloud, is cross-platform, more predictable in feature-poor rooms, and is what indie colocated-AR projects have converged on. |
| D2 | **Keep the stack: React Native + Expo (dev build) + @reactvision/react-viro + Colyseus + TypeScript.** | Viro is actively maintained again (ReactVision spin-out, releases through June 2026, RN New Architecture + current Expo support) and ships the image-marker API (`ViroARImageMarker`) that D1 needs. Colyseus 0.17 (Feb 2026) adds automatic reconnection — a direct fit for mobile churn. One language across app, AR, and server suits a TS-strong solo developer. |
| D3 | **Android and iOS are both P0 platforms.** Android is developed locally; iOS iterates through EAS cloud development builds and its rehearsal build is distributed through TestFlight to a physical ARKit-compatible iPhone. | The shared React Native codebase and marker-based origin make mixed-platform play a core product claim. Windows cannot build iOS locally, so a paid Apple Developer account, EAS cloud build, registered iPhone, TestFlight configuration, and early device testing are mandatory P0 dependencies. |
| D4 | **P0 battles are fixed at 60 seconds.** | Sustained camera + AR inference thermally throttles phones, while battery drain and arm fatigue compound it. A fixed duration also keeps one authoritative timer and a repeatable classroom pace. |
| D5 | **Non-AR fallback mode is a P1 requirement, not an afterthought.** A participant whose phone cannot localize plays the same battle from a top-down minimap view. | Combat is already 2D server-side, so a 2D client view is cheap insurance against device fragmentation. If M0 fails, AR P0 is blocked; switching to a non-AR P0 requires an explicit revised-product decision rather than silently changing scope. |
| D6 | **Quiz rewards become a budget of choices with catch-up mechanics on the product roadmap** (flat mapping stays for the hackathon MVP). | Gimkit/Blooket research: successful platforms map score to spendable resources plus randomness/steal mechanics. "Quiz winner automatically wins the battle" is a documented failure mode — the battle must favor the quiz winner, not crown them. |
| D7 | **Privacy-minimal by design: nickname-only joins, no accounts, no camera upload, no third-party ad/analytics SDKs.** | Classroom tools spread teacher-driven and bottom-up; COPPA applies to under-13 users regardless of who consented. Minimal data collection keeps a single teacher able to run a session with zero IT approval. |
| D8 | **P0 uses three selectable bundled GLB characters with four approved palettes, basic Bolt, and shield-only quiz rewards.** Character and palette choice are cosmetic and never change collision or Battle Stats. Fireball and free spectator view remain post-P0. | The team already produced a bounded local asset catalog, so cosmetic choice can ship without expanding the authoritative combat model or adding remote asset delivery. |
| D9 | **P0 tracking loss is local and non-pausing during battle.** Before battle it clears readiness. During battle the locked server position survives, but firing is allowed only while the AR module is producing a fresh tracked or inertial pose; a stale/unavailable pose disables firing and shows a re-scan prompt. | A global pause is too disruptive for the vertical slice, but firing from a frozen aim direction would be incorrect and unfair. Organizer-controlled pause/recovery policy is P1. |

---

## 3. Users and roles

### Organizer (teacher / workshop facilitator)
- Creates a room, gets a four-digit code
- Selects or authors the quiz (MVP: fixed demo quiz)
- Prints/places the arena marker and defines the arena
- Monitors readiness on a top-down minimap
- Starts the battle; observes server-timed/last-alive completion and final standings
- Is a non-combat controller in P0 and never counts toward participant capacity or battle readiness; a dual organizer/player role is post-P0

### Participant (student / attendee)
- Joins with the room code and a nickname (no account)
- Answers the quiz; receives battle powers
- Chooses one approved bundled GLB character and palette; the selection is cosmetic only
- Scans the floor marker to localize, locks a standing position
- Battles: rotates in place, aims through the camera, fires

**Scale:** up to 12 participants plus one non-combat organizer per room. Quiz-only participants still count toward the 12-participant room limit but are excluded from combat capacity and readiness. Demo target: 3–4 physical devices, with the data model validated for 12 participants.

---

## 4. Goals and non-goals

### Product goals
1. Make quiz results immediately meaningful through battle powers.
2. Deliver a reliable colocated AR battle across participants' Android phones and iPhones.
3. Keep a single organizer able to run a full session in under 15 minutes with no IT support.
4. Keep combat deterministic and server-authoritative on a 2D floor plane — AR is presentation, not physics.
5. Hackathon horizon: a complete, rehearsed vertical slice on 3–4 devices.
6. Product horizon: a tool teachers reach for weekly, not a one-off demo.

### Non-goals (all horizons until revisited)
- Walking/continuous movement during combat (players are stationary)
- Facial or body recognition of any kind
- 3D rigs, mesh/bone colliders, or physics-based projectiles that affect gameplay
- Realistic weapon imagery (fantasy bolts/fireballs only)
- Public matchmaking or play between people not in the same room

### Additional hackathon non-goals
- Named participant accounts, persistent battle state, organizer-authored quizzes, teams, tournaments, anti-cheat beyond server authority

---

## 5. End-to-end experience

### 5.1 Organizer flow
1. **Create War** → receives a four-digit room code, shows it on screen/projector.
2. Selects the demo quiz (later: authors or generates one).
3. Places the **arena marker** — a printed A4 sheet (bundled printable PDF; the app can also display the marker on a spare tablet, with a glare warning) — flat on the floor at the arena center.
4. Scans the marker with their own phone to verify it tracks, then sets the arena radius (3–6 m).
5. Watches the lobby: joins, quiz completion, localization, locked positions on a live minimap.
6. **Start Battle** when everyone is ready → synchronized countdown on all devices.
7. Watches battle state; sees the winner and standings; can run another round.

### 5.2 Participant flow
1. **Join War** → four-digit code + nickname.
2. Completes the fixed ten-question Programming Fundamentals quiz, sees earned powers.
3. Chooses Knight, Ninja, or Wizard and one approved palette; this does not change Battle Stats.
4. Points the camera at the floor marker until the app localizes ("Arena found!").
5. Stands anywhere valid in the arena, **Lock My Position** (server validates boundary + spacing), then **Ready**.
6. On start: rotates in place, aims via the camera crosshair at real classmates (rendered as GLB avatars with name and health bar), fires with on-screen buttons.
7. Sees hits, elimination, and the winner. In P0, an eliminated player sees a non-interactive eliminated overlay with live standings; free spectator view is P1.
8. If AR localization fails after guided retries → **minimap mode** (P1): same battle, top-down aiming.

---

## 6. Game design

### 6.1 Arena and colocation
- The arena is a circle on the 2D floor plane, centered on the marker, radius 3–6 m (organizer-set).
- The printed marker defines the shared coordinate origin. Every device that recognizes it derives its own transform into arena coordinates.
- Marker acquisition has a guided flow (distance, angle, lighting hints) and a re-scan option — Viro image tracking has known jitter/slow-acquisition history, so the UX assumes retries.
- Minimum player spacing is 1.5 m, with a 0.75 m marker exclusion radius; both are server-enforced at position lock.

### 6.2 Positioning
- Position is captured once, pre-battle, as marker-relative X/Z. Y is ignored by gameplay.
- Players rotate freely but must not walk (rule + instruction for MVP; drift/movement warnings later).

### 6.3 Targeting
- Camera center is the reticle; the phone's forward vector is projected onto the X/Z floor plane and sent with each attack. Its vertical component is discarded: aiming above or below an avatar's head does not change the gameplay direction when the floor-plane direction is the same.
- If the projected horizontal vector is too small to normalize (for example, the phone points nearly straight up or down), firing is disabled with a brief "aim level" cue; no vertical 3D raycast fallback exists.
- Server does ray-vs-circle hit testing on the 2D plane; nearest eligible target along the ray wins.
- **Hit cones are deliberately generous** (hit radius + ray width tuned wide): marker-based colocation plus per-device drift means a few degrees of error is normal. Aim assistance (highlighted reticle + target name) closes the rest of the gap.
- The client's predicted target is diagnostic only — the server never trusts a client-sent target ID.

### 6.4 Health, elimination, match end
- 100 HP per player; 0 HP → eliminated → P0 eliminated overlay (free spectator view is P1).
- Battle ends when one player remains **or the timer expires (default 60 s, hard cap 90 s — see D4)**.
- Timer expiry: highest remaining HP wins; ties break by quiz score.

### 6.5 Quiz reward economy
**P0 (hackathon):** the fixed server-owned `programming-fundamentals-v1` template has ten questions: seven basic/intermediate questions at 30 seconds each, three difficult questions at 45 seconds each, and a five-second server-timed reveal after every question. It uses this deterministic shield-only mapping:

| Correct answers | Reward |
|---:|---|
| 0–2 | Basic attack only |
| 3–4 | +10 starting shield |
| 5–6 | +20 starting shield |
| 7–8 | +30 starting shield |
| 9–10 | +40 starting shield |

The versioned P0 template content is:

| # | Tier / time | Question | Options | Correct answer | Reveal explanation |
|---:|---|---|---|---|---|
| 1 | Basic / 30 s | `let x = 3; x = x + 2;` What is `x`? | 3; 5; 6; error | 5 | The assignment replaces the old value with `3 + 2`. |
| 2 | Basic / 30 s | What is the type of `true`? | string; number; boolean; object | boolean | `true` and `false` are boolean values. |
| 3 | Basic / 30 s | What does `if (7 > 10) { "A" } else { "B" }` select? | A; B; both; neither | B | `7 > 10` is false, so the `else` branch runs. |
| 4 | Basic / 30 s | How many times does `for (let i = 0; i < 4; i++)` run? | 3; 4; 5; infinitely | 4 | It runs for `i = 0, 1, 2, 3`. |
| 5 | Basic / 30 s | `function triple(n) { return n * 3; }` What is `triple(4)`? | 7; 12; 16; undefined | 12 | The function returns its input multiplied by three. |
| 6 | Intermediate / 30 s | Given `const a = [10, 20, 30]`, what is `a[1]`? | 10; 20; 30; undefined | 20 | Array indexes begin at zero. |
| 7 | Intermediate / 30 s | `const user = { name: "Ada", level: 1 }; user.level = 2;` What is `user.name`? | Ada; 1; 2; undefined | Ada | Updating one property does not change another. |
| 8 | Difficult / 45 s | `const a = { score: 1 }; const b = a; b.score = 4;` What is `a.score`? | 1; 4; undefined; error | 4 | Both variables refer to the same object. |
| 9 | Difficult / 45 s | A loop runs `n` times and contains another loop that also runs `n` times. What is the usual time complexity? | O(1); O(n); O(n log n); O(n²) | O(n²) | The body executes roughly `n × n` times. |
| 10 | Difficult / 45 s | What must be true before using binary search correctly? | list is sorted; no duplicates; all numbers; exactly 10 items | list is sorted | Binary search discards half based on ordering. |

**Product (per D6):** quiz score becomes a **point budget spent on a loadout** (shield / extra charges / one-time abilities), with:
- a guaranteed minimum kit (floor) and diminishing returns at the top (cap),
- at least one catch-up/disruption mechanic (e.g., eliminated players' unspent charges scatter as pickups, or a "steal" ability),
so the quiz winner is favored, never guaranteed.

### 6.6 Weapons (tunable constants, not hard-coded)

| Weapon | Range | Ray width | Damage | Rule |
|---|---:|---:|---:|---|
| Basic bolt | 8 m | 0.35 m | 10 | Short cooldown, unlimited |
| Shield | — | — | — | Absorbs damage before HP |

Fireball is a future mechanic and has no P0 state, command, UI control, or dormant resolver.

---

## 7. Feature scope

### P0 — hackathon vertical slice (nothing else starts until this works end-to-end on one Android phone and one iPhone)
- **Room/lobby:** create room (4-digit code), join with code + nickname, live participant list, capacity 12, ready states
- **Platforms:** Android and iOS device builds; the M1 rehearsal includes at least one physical phone of each platform
- **Quiz:** fixed ten-question Programming Fundamentals template, server-timed sequential answers, scoring, deterministic shield-only reward mapping, completion visible to organizer
- **Colocation:** bundled printable marker; marker scan → localization state; circular arena boundary
- **Positioning:** lock marker-relative X/Z; server validates boundary + spacing; organizer minimap
- **Battle:** synchronized countdown; crosshair + floor-projected aim; server-authoritative 2D hit testing; basic attack; HP + shield; cooldowns; elimination overlay + live standings; winner; 60 s timer
- **Feedback:** target name/HP on lock, projectile/flash + hit effects, sound or haptics, winner screen; three bundled cosmetic GLBs with four approved palettes

### P1 — after P0 works
- Fireball only after its reward, charge, command, and balance contract is designed and tested
- Spectator view for eliminated players
- **Non-AR minimap fallback mode** (D5)
- Tracking-loss pause; organizer force-remove/reset player

### P2 — product horizon
- Organizer-authored quizzes; AI-generated questions from workshop notes
- Loadout economy + catch-up mechanics (D6)
- Movement warnings (drift detection); teams; tournament heats; multiple arenas
- Match history, classroom analytics, profiles for organizers (participants stay account-free)
- Big-screen spectator view on the organizer's projector (battle rendered top-down for the audience)

---

## 8. Functional requirements

### FR-1: Create room
Organizer creates a room and receives an active four-digit code.
- Room creation happens through the Colyseus matchmaking connection flow before ordinary room messages can be sent. The server assigns the four-digit public code as the room identifier and returns the connected room to the organizer.
- Exactly four digits; active codes never collide; room expires after two hours of inactivity; creator gets server-bound host privileges and a rotating reconnect token.
- The organizer is a non-combat role in P0. Organizer-only commands are rejected unless the connected client owns that server-assigned role.

### FR-2: Join room
Participant joins with code + nickname.
- Invalid/expired code → clear inline error, entered name retained.
- Duplicate nicknames get a suffix; participant #13 is rejected.
- Joining resolves the four-digit code through Colyseus matchmaking before normal room state/messages begin; `join_room` is not an in-room command.
- Before the quiz, the organizer may mark a participant quiz-only; quiz-only participants still count toward the 12-participant room limit, do not need AR localization or a position, and never block battle start.

### FR-2a: Run the P0 quiz
The organizer selects the bundled `programming-fundamentals-v1` template and starts the session. The server presents one question at a time, accepts one answer per participant before the server deadline, reveals the answer and explanation for five seconds, then advances automatically. Correct answers and explanations remain server-private until each question closes.

### FR-3: Localize via marker
Each client establishes the shared arena origin by recognizing the floor marker.
- App bundles the marker image and a printable PDF.
- Client reports coarse localization state (`searching` / `localized` / `lost`) to the server. Pose freshness and quality remain local to the AR module.
- Guided scan UX with retry; AR P0 battle start is blocked for unlocalized combat participants. P1 minimap participants use a separately defined readiness path.
- Before countdown, loss clears readiness. After position lock during P0 battle, loss does not invalidate the locked server position. A fresh inertial pose may continue aiming; a stale or unavailable pose disables firing locally and shows a re-scan prompt.

### FR-4: Lock position
- Stored as marker-relative X/Z; rejected outside the arena, inside the marker safety zone, or violating minimum spacing. Rejections include a structured correction vector/distance for directional guidance; positions are unlockable before start and visible on the organizer minimap.

### FR-5: Start battle
- Server permits start only when every combat-included participant is connected, localized, quiz-complete, positioned, and ready; quiz-only participants are excluded from this invariant.
- Server emits a future `startsAt` and a server-time offset; all clients run the countdown from server time.
- The non-combat organizer never participates in this invariant. If the organizer disconnects before countdown, progression waits up to 60 seconds for reconnection; an already-started countdown or battle continues server-authoritatively.

### FR-6: Resolve attack
- Client sends round ID, unique command ID, weapon, and a fresh aim direction (never a trusted target ID); P0 resolves attacks at server receipt time and deduplicates command IDs.
- Server rejects attacks during cooldown, before start, from eliminated players.
- Nearest eligible ray-circle intersection wins; shield absorbs before HP; authoritative results carry the round ID and monotonically increasing event sequence so clients can reject stale/duplicate effects.

### FR-7: Complete battle
- Eliminated players cannot attack; in P0 they see an eliminated overlay with live standings. Battle ends at last-player-standing or timer expiry; all clients agree on the winner.
- Organizer reset retains connected identities/nicknames/roles only; it increments `roundId` and clears quiz answers/scores/rewards, localization, positions, readiness, HP/shield, cooldowns, eliminations, and per-round event sequence.

---

## 9. Non-functional requirements

### Performance & thermals
- ≥30 FPS on a mid-range 2023+ Android phone and the designated ARKit-compatible iPhone; bounded GLB budgets, pooled effects, labels culled to near-view players.
- Attacks feel responsive at ≤250 ms round trip.
- **Total continuous AR camera time per participant ≤3 minutes per session** (localization + battle) to stay ahead of thermal throttling; the camera is off during lobby/quiz.

### Reliability
- Server is the single source of truth for readiness, combat, results.
- Colyseus reconnection reattaches a returning participant to their player record; room state survives brief disconnects.
- Tracking loss surfaces immediately with recovery guidance.
- Design for hostile school WiFi: tiny message payloads, low send rates, tolerate jitter; organizer-hotspot setup documented as the recommended network.
- P0 is in-memory: a server-process restart ends the room and every client receives a clear session-ended/rejoin experience; restart recovery is not promised.

### Safety
- Stationary play, 1.5 m default minimum spacing, a 0.75 m marker exclusion radius, and a pre-battle safety notice ("feet planted, rotate only").
- Fantasy effects only; nothing gun-shaped in UI or marketing.

### Privacy (D7)
- No camera frames ever leave the device; no facial recognition; camera purpose explained at permission time.
- Nickname-only participants, no student accounts, no third-party ads/analytics SDKs, data minimization throughout.
- Room, quiz, combat, results, and nickname state are in-memory and deleted on room expiry. P0 has no Firebase, database, account, or cloud-persistence dependency. Operational logs redact nicknames; reconnect tokens are random, short-lived, and never synchronized or logged.

### Accessibility
- Target lock never communicated by color alone; hits paired with sound/haptics; high-contrast panels and scrims over camera backgrounds; organizer can include someone in the quiz but exclude them from combat.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Viro image-marker tracking is jittery/slow on real devices | Critical | **First technical gate** (see build spec): prove Android-to-iOS marker colocation before any feature work; generous hit cones; guided scan UX; re-scan affordance |
| Per-device drift after marker scan misaligns aim | High | Stationary players, wide cones, aim assist, optional re-scan; battles too short for major drift |
| iOS build, signing, or marker regression | Critical | Build and test an ARKit-compatible iPhone in M0; no Android-only completion path for P0 |
| Device fragmentation (some phones can't AR) | High | P1 minimap fallback mode; ARCore/ARKit support check at join |
| Thermal throttling mid-battle | Medium | 60–90 s battles, camera off outside AR phases, bounded bundled-GLB budgets |
| School WiFi jitter/congestion | Medium | Fixed positions + discrete attack events (not continuous sync); hotspot guidance |
| ViroReact regression (small maintainer) | Medium | Pin versions; combat/net layer is Viro-independent; Unity port remains possible without touching the server |
| Scope creep before the vertical slice works | High | Hard P0 gate; no P1 work until P0 runs on an Android phone and an iPhone |
| Physical crowding at 12 players | Medium | Spacing validation, capacity enforcement, stationary rules |

---

## 11. Roadmap

| Milestone | Contents | Exit criteria |
|---|---|---|
| **M0 — Colocation spike** | Expo/Viro builds on one Android and one iPhone; both scan one marker; a test object appears in the same physical spot | Go/conditional/no-go on cross-platform marker quality; no-go blocks AR P0 pending an explicit revised-product decision |
| **M1 — Hackathon vertical slice (P0)** | Full flow: create → join → quiz → localize → lock → battle → winner, on 3–4 devices including Android and iOS; final iOS rehearsal build distributed through TestFlight | Demo success criteria below, twice in a row |
| **M2 — Hardening (P1)** | Spectator view, minimap fallback, tracking recovery, organizer moderation, reconnection polish; Fireball only after a separate game/protocol decision | A stranger can run a session from a one-page guide |
| **M3 — Product (P2)** | Authored quizzes, loadout economy, big-screen spectator view, analytics | First real classroom pilots |

### Demo success criteria (M1)
1. Organizer creates a room and shows the code; ≥2 participants join and answer the quiz, including at least one Android and one iPhone.
2. All participants localize on the printed marker and lock distinct positions; organizer sees them on the minimap.
3. Battle starts with a synchronized countdown; one participant aims at another and gets target-lock feedback.
4. An attack produces synchronized damage on both phones; a player is eliminated; the same winner shows everywhere.

---

## 12. Open questions
- Marker design: which image maximizes Viro tracking quality at 2–4 m? (Resolve in M0 with A/B of 2–3 candidates.)
- Can a tablet-displayed marker substitute for print reliably, or is print required? (M0.)
- Exact loadout economy for P2 — design after observing real MVP sessions.
- Hosting for Colyseus beyond the hackathon (a $5 VPS is fine for MVP; revisit at M3).
