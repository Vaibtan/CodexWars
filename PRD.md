# CodexWars — Product Requirements Document

**Version:** 2.7
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
| D1 | **Marker-based colocation replaces cloud anchors** as the shared-origin mechanism. A printed image marker on the floor is the arena origin; every phone scans it. | Marker colocation avoids a hosted spatial dependency, works on the LAN-only demo topology, is cross-platform, and maps directly to Viro's measured image-target APIs. Physical accuracy remains gated by M0. |
| D2 | **Keep the stack: React Native + Expo development builds + `@reactvision/react-viro` + Colyseus + TypeScript.** | The pinned stack builds the native Android client, Viro supplies measured image targets and marker-relative rendering, and Colyseus supplies the authoritative room/state/reconnection lifecycle. One language and one shared contract package keep the mobile/server boundary tractable. |
| D3 | **Android and iOS are both P0 platforms.** Android is developed locally; iOS iterates through EAS cloud development builds and its rehearsal build is distributed through TestFlight to a physical ARKit-compatible iPhone. | The shared React Native codebase and marker-based origin make mixed-platform play a core product claim. Windows cannot build iOS locally, so a paid Apple Developer account, EAS cloud build, registered iPhone, TestFlight configuration, and early device testing are mandatory P0 dependencies. |
| D4 | **P0 battles are fixed at 60 seconds.** | Sustained camera + AR inference thermally throttles phones, while battery drain and arm fatigue compound it. A fixed duration also keeps one authoritative timer and a repeatable classroom pace. |
| D5 | **Non-AR fallback mode is a P1 requirement, not an afterthought.** A participant whose phone cannot localize plays the same battle from a top-down minimap view. | Combat is already 2D server-side, so a 2D client view is cheap insurance against device fragmentation. If M0 fails, AR P0 is blocked; switching to a non-AR P0 requires an explicit revised-product decision rather than silently changing scope. |
| D6 | **Quiz rewards become a budget of choices with catch-up mechanics on the product roadmap** (flat mapping stays for the hackathon MVP). | Gimkit/Blooket research: successful platforms map score to spendable resources plus randomness/steal mechanics. "Quiz winner automatically wins the battle" is a documented failure mode — the battle must favor the quiz winner, not crown them. |
| D7 | **Privacy-minimal by design: nickname-only joins, no accounts, no camera upload, no third-party ad/analytics SDKs.** | Classroom tools spread teacher-driven and bottom-up; COPPA applies to under-13 users regardless of who consented. Minimal data collection keeps a single teacher able to run a session with zero IT approval. |
| D8 | **P0 uses three selectable bundled GLB characters with four approved palettes, basic Bolt, and shield-only quiz rewards.** Character and palette choice are cosmetic and never change collision or Battle Stats. Fireball and free spectator view remain post-P0. | The team already produced a bounded local asset catalog, so cosmetic choice can ship without expanding the authoritative combat model or adding remote asset delivery. |
| D9 | **P0 tracking loss is local and non-pausing during battle.** Before battle it clears readiness. During battle the locked server position survives, but firing is allowed only while the retained marker anchor produces a fresh tracked or degraded/inertial pose; marker removal, stale pose, or unavailable world tracking disables firing and shows a re-scan prompt. | A global pause is too disruptive for the vertical slice, but firing from a frozen aim direction would be incorrect and unfair. Organizer-controlled pause/recovery policy is P1. |
| D10 | **The hosted pilot replaces the programming demo quiz with server-prepared general-knowledge, current-events, or mixed quizzes.** GPT-5.4 mini may generate a bounded candidate buffer with web evidence; the server deterministically selects exactly ten independently approved questions before organizer approval, while a curated evergreen fallback gates every round. | Preparation happens before gameplay, all participants receive the same frozen ten-question template, and no provider key or answer authority reaches the client. The fallback preserves the complete game when generation is disabled, unavailable, invalid, or over budget. |

---

## 3. Users and roles

### Organizer (teacher / workshop facilitator)
- Creates a room, gets a four-digit code
- Configures a bounded quiz mode/category/difficulty, reviews the prepared quiz, and approves or regenerates it
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
2. Chooses general knowledge, current events, or mixed mode plus an allow-listed category and difficulty profile. The server prepares all ten questions, shows the organizer a private preview with sources, and requires approval before quiz start. If generation is disabled or fails policy/validation, the server selects the curated evergreen fallback.
3. Places the **arena marker** — the bundled A4 PDF printed at 100% / Actual size with a 180 mm black square — flat on the floor at the arena center. A screen-displayed substitute is not part of P0.
4. Scans the marker with their own phone to verify it tracks, then sets the arena radius (3–6 m).
5. Watches the lobby: joins, quiz completion, localization, locked positions on a live minimap.
6. **Start Battle** when everyone is ready → synchronized countdown on all devices.
7. Watches battle state; sees the winner and standings; can run another round.

### 5.2 Participant flow
1. **Join War** → four-digit code + nickname.
2. Completes the same server-frozen ten-question quiz as every other participant and sees earned powers.
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
- Battle ends when one player remains **or the fixed 60-second timer expires** (D4).
- Timer expiry: highest remaining HP wins; ties break by quiz score.

### 6.5 Quiz reward economy
**Hosted pilot:** the server prepares one immutable ten-question template before gameplay. Content is general knowledge, current events, or a server-defined mixture; seven basic/intermediate questions run for 30 seconds, three difficult questions run for 45 seconds, and every question has a five-second server-timed reveal. Current-events questions cover completed factual events inside the configured lookback window, exclude developing stories, and require at least two independent reputable sources. The organizer receives a private preview and approves the generated candidate. Participants never receive future questions, answer keys, review results, or source-derived answer hints before reveal.

GPT-5.4 mini generation is optional runtime infrastructure, not gameplay authority. The server validates exact structure, option uniqueness, answer/explanation consistency, evidence, recency, classroom safety, and ambiguity before accepting a candidate. Any disabled, timed-out, malformed, unsafe, unsupported, over-budget, or cancelled preparation resolves to a reviewed evergreen general-knowledge fallback. Once approved or selected as fallback, the same template, ordering, answer key, explanations, timing, and scoring are frozen for the entire War Room round. The deterministic shield-only mapping remains:

| Correct answers | Reward |
|---:|---|
| 0–2 | Basic attack only |
| 3–4 | +10 starting shield |
| 5–6 | +20 starting shield |
| 7–8 | +30 starting shield |
| 9–10 | +40 starting shield |

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
- **Quiz:** server-prepared ten-question general-knowledge/current-events template with private organizer approval, curated offline fallback, server-timed sequential answers, scoring, deterministic shield-only rewards, and completion visible to the organizer
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
- Organizer-authored quizzes and generation from uploaded workshop notes
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

### FR-2a: Prepare and run the quiz
The organizer configures only allow-listed content mode, category, difficulty, and recency values. The server accepts one preparation job per room, bounds regeneration attempts and global spend, validates and reviews the complete candidate, then privately previews generated questions and source links to the organizer. Approval freezes generated content; fallback content is already human-approved. `start_quiz` is unavailable while unconfigured, generating, or awaiting approval. During play the server presents one question at a time, accepts one answer per participant before the deadline, reveals the answer and explanation for five seconds, then advances automatically. Reset cancels stale preparation and requires a new preparation for the next round.

### FR-3: Localize via marker
Each client establishes the shared arena origin by recognizing the floor marker.
- App bundles the marker image and a printable PDF.
- Client reports coarse localization state (`searching` / `localized` / `lost`) to the server. Pose freshness and quality remain local to the AR module.
- Guided scan UX with retry; AR P0 battle start is blocked for unlocalized combat participants. P1 minimap participants use a separately defined readiness path.
- Before countdown, loss clears readiness. After position lock during P0 battle, loss does not invalidate the locked server position. A degraded anchor may continue aiming only while its marker-relative pose remains fresh; marker removal, a stale pose, or unavailable world tracking disables firing locally and shows a re-scan prompt.

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
- Organizer reset retains connected identities/nicknames/roles only; it increments `roundId`, restores the default character and gold palette, and clears quiz answers/scores/rewards, localization, positions, readiness, HP/shield, cooldowns, eliminations, and per-round event sequence. Disconnected participants are removed.

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
- Missing or failed quiz-generation infrastructure never blocks readiness or a complete round; the server reports fallback-only capability and uses the curated template.

### Safety
- Stationary play, 1.5 m default minimum spacing, a 0.75 m marker exclusion radius, and a pre-battle safety notice ("feet planted, rotate only").
- Fantasy effects only; nothing gun-shaped in UI or marketing.
- Generated quiz content excludes graphic tragedy, active-conflict detail, discriminatory framing, targeted political persuasion, and facts that may change during the room lifetime.

### Privacy (D7)
- No camera frames ever leave the device; no facial recognition; camera purpose explained at permission time.
- Nickname-only participants, no student accounts, no third-party ads/analytics SDKs, data minimization throughout.
- Room, quiz, evidence, review, combat, results, and nickname state are in-memory and deleted on room expiry. There is no Firebase, database, account, or cloud-persistence dependency. The OpenAI key is server-only. Operational logs redact nicknames, quiz content, answers, sources, coordinates, and credentials; reconnect tokens are random, short-lived, and never synchronized or logged.

### Accessibility
- Target lock never communicated by color alone; hits paired with sound/haptics; high-contrast panels and scrims over camera backgrounds; organizer can include someone in the quiz but exclude them from combat.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Viro image-marker tracking is jittery/slow on real devices | Critical | Keep M0 as a release gate: prove Android-to-iOS marker colocation before declaring the AR slice complete; use generous hit cones, guided scan UX, and re-scan affordance |
| Per-device drift after marker scan misaligns aim | High | Stationary players, wide cones, aim assist, optional re-scan; battles too short for major drift |
| iOS build, signing, or marker regression | Critical | Build and test an ARKit-compatible iPhone in M0; no Android-only completion path for P0 |
| Device fragmentation (some phones can't AR) | High | P1 minimap fallback mode; ARCore/ARKit support check at join |
| Thermal throttling mid-battle | Medium | Fixed 60 s battles, camera off outside participant AR phases, bounded bundled-GLB budgets |
| School WiFi jitter/congestion | Medium | Fixed positions + discrete attack events (not continuous sync); hotspot guidance |
| ViroReact regression (small maintainer) | Medium | Pin versions; combat/net layer is Viro-independent; Unity port remains possible without touching the server |
| Scope creep before the vertical slice works | High | Hard P0 gate; no P1 work until P0 runs on an Android phone and an iPhone |
| Physical crowding at 12 players | Medium | Spacing validation, capacity enforcement, stationary rules |

---

## 11. Roadmap

| Milestone | Contents | Exit criteria |
|---|---|---|
| **M0 — Colocation spike** | Expo/Viro builds on one Android and one iPhone; both scan one marker; a test object appears in the same physical spot | Go/conditional/no-go on cross-platform marker quality; no-go blocks AR P0 pending an explicit revised-product decision |
| **M1 — Hackathon vertical slice (P0)** | Full flow: create → join → prepare/approve quiz → play quiz → localize → lock → battle → winner, on 3–4 devices including Android and iOS; final iOS rehearsal build distributed through TestFlight | Demo success criteria below, twice in a row; fallback path must also complete |
| **M2 — Hardening (P1)** | Spectator view, minimap fallback, tracking recovery, organizer moderation, reconnection polish; Fireball only after a separate game/protocol decision | A stranger can run a session from a one-page guide |
| **M3 — Product (P2)** | Authored quizzes, loadout economy, big-screen spectator view, analytics | First real classroom pilots |

### Demo success criteria (M1)
1. Organizer creates a room and shows the code; ≥2 participants join and answer the quiz, including at least one Android and one iPhone.
2. All participants localize on the printed marker and lock distinct positions; organizer sees them on the minimap.
3. Battle starts with a synchronized countdown; one participant aims at another and gets target-lock feedback.
4. An attack produces synchronized damage on both phones; a player is eliminated; the same winner shows everywhere.

---

## 12. Open questions
- Does the bundled 180 mm marker meet the M0 acquisition, alignment, heading, and drift thresholds on the designated Android/iPhone pair? Replace or resize it only if those measurements fail.
- Exact loadout economy for P2 — design after observing real MVP sessions.
- Hosting for Colyseus beyond the hackathon (a $5 VPS is fine for MVP; revisit at M3).
