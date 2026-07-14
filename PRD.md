# CodexWars — Product Requirements Document

**Version:** 2.0
**Status:** Approved direction — supersedes `CODEXWARS_PRD_TDD.md` (v1 draft, retained for reference)
**Horizons:** Hackathon demo first → evolve into a real product
**Primary platform:** Android (iOS follows via EAS cloud builds — no Mac available for local builds)
**Last updated:** 2026-07-14

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
| D3 | **Android-first for real, not as a fallback.** iOS arrives post-hackathon via Expo EAS cloud builds + TestFlight. | Development machine is Windows; no Mac means no local iOS builds or debugging. Pretending iOS is a hackathon-day option burns the scarcest resource (time). The RN codebase keeps iOS cheap later. |
| D4 | **Battles are hard-capped at 90 seconds** (default 60s). | Sustained camera + AR inference thermally throttles phones in roughly 60–90 seconds; battery drain and arm fatigue ("gorilla arm") compound it. Short battles are also better pacing for a classroom finale. |
| D5 | **Non-AR fallback mode is a P1 requirement, not an afterthought.** A participant whose phone can't localize plays the same battle from a top-down minimap view. | Every comparable colocated-AR product died partly from device fragmentation. Combat is already 2D server-side, so a 2D client view is cheap insurance that one bad phone can't ruin a 12-person session. |
| D6 | **Quiz rewards become a budget of choices with catch-up mechanics on the product roadmap** (flat mapping stays for the hackathon MVP). | Gimkit/Blooket research: successful platforms map score to spendable resources plus randomness/steal mechanics. "Quiz winner automatically wins the battle" is a documented failure mode — the battle must favor the quiz winner, not crown them. |
| D7 | **Privacy-minimal by design: nickname-only joins, no accounts, no camera upload, no third-party ad/analytics SDKs.** | Classroom tools spread teacher-driven and bottom-up; COPPA applies to under-13 users regardless of who consented. Minimal data collection keeps a single teacher able to run a session with zero IT approval. |

---

## 3. Users and roles

### Organizer (teacher / workshop facilitator)
- Creates a room, gets a four-digit code
- Selects or authors the quiz (MVP: fixed demo quiz)
- Prints/places the arena marker and defines the arena
- Monitors readiness on a top-down minimap
- Starts and ends the battle; sees final standings

### Participant (student / attendee)
- Joins with the room code and a nickname (no account)
- Answers the quiz; receives battle powers
- Picks a character sprite and color
- Scans the floor marker to localize, locks a standing position
- Battles: rotates in place, aims through the camera, fires

**Scale:** up to 12 participants per arena. Demo target: 3–4 physical devices, with the data model validated for 12.

---

## 4. Goals and non-goals

### Product goals
1. Make quiz results immediately meaningful through battle powers.
2. Deliver a reliable colocated AR battle on participants' own Android phones.
3. Keep a single organizer able to run a full session in under 15 minutes with no IT support.
4. Keep combat deterministic and server-authoritative on a 2D floor plane — AR is presentation, not physics.
5. Hackathon horizon: a complete, rehearsed vertical slice on 3–4 devices.
6. Product horizon: a tool teachers reach for weekly, not a one-off demo.

### Non-goals (all horizons until revisited)
- Walking/continuous movement during combat (players are stationary)
- Facial or body recognition of any kind
- Full 3D character rigs or physics-based 3D projectiles
- Realistic weapon imagery (fantasy bolts/fireballs only)
- Public matchmaking or play between people not in the same room

### Additional hackathon non-goals
- iOS build, accounts/auth, persistence, organizer-authored quizzes, teams, tournaments, anti-cheat beyond server authority

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
2. Completes the quiz (MVP: 3 multiple-choice questions), sees earned powers.
3. Picks a character sprite and color.
4. Points the camera at the floor marker until the app localizes ("Arena found!").
5. Stands anywhere valid in the arena, **Lock My Position** (server validates boundary + spacing), then **Ready**.
6. On start: rotates in place, aims via the camera crosshair at real classmates (rendered with sprite, name, and health bar), fires with on-screen buttons.
7. Sees hits, eliminations, and the winner. Eliminated players spectate.
8. If AR localization fails after guided retries → **minimap mode** (P1): same battle, top-down aiming.

---

## 6. Game design

### 6.1 Arena and colocation
- The arena is a circle on the 2D floor plane, centered on the marker, radius 3–6 m (organizer-set).
- The printed marker defines the shared coordinate origin. Every device that recognizes it derives its own transform into arena coordinates.
- Marker acquisition has a guided flow (distance, angle, lighting hints) and a re-scan option — Viro image tracking has known jitter/slow-acquisition history, so the UX assumes retries.
- Minimum player spacing: 1.2–1.5 m, server-enforced at position lock.

### 6.2 Positioning
- Position is captured once, pre-battle, as marker-relative X/Z. Y is ignored by gameplay.
- Players rotate freely but must not walk (rule + instruction for MVP; drift/movement warnings later).

### 6.3 Targeting
- Camera center is the reticle; the phone's forward vector is projected onto the floor plane and sent with each attack.
- Server does ray-vs-circle hit testing on the 2D plane; nearest eligible target along the ray wins.
- **Hit cones are deliberately generous** (hit radius + ray width tuned wide): marker-based colocation plus per-device drift means a few degrees of error is normal. Aim assistance (highlighted reticle + target name) closes the rest of the gap.
- The client's predicted target is diagnostic only — the server never trusts a client-sent target ID.

### 6.4 Health, elimination, match end
- 100 HP per player; 0 HP → eliminated → spectator.
- Battle ends when one player remains **or the timer expires (default 60 s, hard cap 90 s — see D4)**.
- Timer expiry: highest remaining HP wins; ties break by quiz score.

### 6.5 Quiz reward economy
**MVP (hackathon):** deterministic flat mapping —

| Correct answers | Reward |
|---:|---|
| 0 | Basic attack only |
| 1 | +10 starting shield |
| 2 | +1 fireball charge |
| 3 | +20 shield and +1 fireball charge |

**Product (per D6):** quiz score becomes a **point budget spent on a loadout** (shield / extra charges / one-time abilities), with:
- a guaranteed minimum kit (floor) and diminishing returns at the top (cap),
- at least one catch-up/disruption mechanic (e.g., eliminated players' unspent charges scatter as pickups, or a "steal" ability),
so the quiz winner is favored, never guaranteed.

### 6.6 Weapons (tunable constants, not hard-coded)

| Weapon | Range | Ray width | Damage | Rule |
|---|---:|---:|---:|---|
| Basic bolt | 8 m | 0.35 m | 10 | Short cooldown, unlimited |
| Fireball | 7 m | 0.55 m | 20 | Limited charges |
| Shield | — | — | — | Absorbs damage before HP |

---

## 7. Feature scope

### P0 — hackathon vertical slice (nothing else starts until this works end-to-end on 2 phones)
- **Room/lobby:** create room (4-digit code), join with code + nickname, live participant list, capacity 12, ready states
- **Quiz:** 3 fixed MCQs, scoring, deterministic reward mapping, completion visible to organizer
- **Colocation:** bundled printable marker; marker scan → localization state; circular arena boundary
- **Positioning:** lock marker-relative X/Z; server validates boundary + spacing; organizer minimap
- **Battle:** synchronized countdown; crosshair + floor-projected aim; server-authoritative 2D hit testing; basic attack; HP + shield; cooldowns; elimination; winner; 60 s timer
- **Feedback:** target name/HP on lock, projectile/flash + hit effects, sound or haptics, winner screen

### P1 — after P0 works
- Fireball; 3 character sprites + color choice
- Spectator view for eliminated players
- **Non-AR minimap fallback mode** (D5)
- Tracking-loss pause; organizer force-remove/reset player
- iOS via EAS cloud build + TestFlight

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
- Exactly four digits; active codes never collide; room expires after the event window; creator gets host privileges.

### FR-2: Join room
Participant joins with code + nickname.
- Invalid/expired code → clear inline error, entered name retained.
- Duplicate nicknames get a suffix; participant #13 is rejected.

### FR-3: Localize via marker
Each client establishes the shared arena origin by recognizing the floor marker.
- App bundles the marker image and a printable PDF.
- Client reports localization state (`searching` / `localized` / `lost`) to the server.
- Guided scan UX with retry; battle start is blocked for unlocalized participants (unless in fallback mode, P1).
- Marker loss after position lock does not invalidate the locked position (players are stationary; aiming continues on inertial tracking, with a re-scan prompt).

### FR-4: Lock position
- Stored as marker-relative X/Z; rejected outside the boundary or violating minimum spacing, with directional guidance; unlockable before start; visible on the organizer minimap.

### FR-5: Start battle
- Server permits start only when every included participant is connected, localized, quiz-complete, positioned, and ready.
- Server emits a future `startsAt`; all clients run a synchronized countdown.

### FR-6: Resolve attack
- Client sends weapon + aim direction (never a trusted target ID) + client timestamp.
- Server rejects attacks during cooldown, before start, from eliminated players.
- Nearest eligible ray-circle intersection wins; shield absorbs before HP; authoritative result broadcast to all clients.

### FR-7: Complete battle
- Eliminated players cannot attack; battle ends at last-player-standing or timer expiry; all clients agree on the winner; organizer can reset to lobby for another round.

---

## 9. Non-functional requirements

### Performance & thermals
- ≥30 FPS on a mid-range 2023+ Android phone; low-res sprites, pooled effects, labels culled to near-view players.
- Attacks feel responsive at ≤250 ms round trip.
- **Total continuous AR camera time per participant ≤3 minutes per session** (localization + battle) to stay ahead of thermal throttling; the camera is off during lobby/quiz.

### Reliability
- Server is the single source of truth for readiness, combat, results.
- Colyseus reconnection reattaches a returning participant to their player record; room state survives brief disconnects.
- Tracking loss surfaces immediately with recovery guidance.
- Design for hostile school WiFi: tiny message payloads, low send rates, tolerate jitter; organizer-hotspot setup documented as the recommended network.

### Safety
- Stationary play, minimum spacing, pre-battle safety notice ("feet planted, rotate only").
- Fantasy effects only; nothing gun-shaped in UI or marketing.

### Privacy (D7)
- No camera frames ever leave the device; no facial recognition; camera purpose explained at permission time.
- Nickname-only participants, no student accounts, no third-party ads/analytics SDKs, data minimization throughout.

### Accessibility
- Target lock never communicated by color alone; hits paired with sound/haptics; high-contrast panels and scrims over camera backgrounds; organizer can include someone in the quiz but exclude them from combat.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Viro image-marker tracking is jittery/slow on real devices | Critical | **First technical gate** (see build spec): prove 2-device marker colocation before any feature work; generous hit cones; guided scan UX; re-scan affordance |
| Per-device drift after marker scan misaligns aim | High | Stationary players, wide cones, aim assist, optional re-scan; battles too short for major drift |
| Device fragmentation (some phones can't AR) | High | P1 minimap fallback mode; ARCore-support check at join |
| Thermal throttling mid-battle | Medium | 60–90 s battles, camera off outside AR phases, sprite-based rendering |
| School WiFi jitter/congestion | Medium | Fixed positions + discrete attack events (not continuous sync); hotspot guidance |
| ViroReact regression (small maintainer) | Medium | Pin versions; combat/net layer is Viro-independent; Unity port remains possible without touching the server |
| Scope creep before the vertical slice works | High | Hard P0 gate; no P1 work until P0 runs on two phones |
| Physical crowding at 12 players | Medium | Spacing validation, capacity enforcement, stationary rules |

---

## 11. Roadmap

| Milestone | Contents | Exit criteria |
|---|---|---|
| **M0 — Colocation spike** | Expo dev build + Viro on 2 Android phones; both scan one marker; a test object appears in the same physical spot | Go/no-go on marker colocation quality |
| **M1 — Hackathon vertical slice (P0)** | Full flow: create → join → quiz → localize → lock → battle → winner, on 3–4 Android devices | Demo success criteria below |
| **M2 — Hardening (P1)** | Fireball, sprites/colors, spectator view, minimap fallback, reconnection polish | A stranger can run a session from a one-page guide |
| **M3 — iOS** | EAS cloud build, TestFlight, cross-platform marker testing | Mixed Android/iOS session works |
| **M4 — Product (P2)** | Authored quizzes, loadout economy, big-screen spectator view, analytics | First real classroom pilots |

### Demo success criteria (M1)
1. Organizer creates a room and shows the code; ≥2 participants join and answer the quiz.
2. All participants localize on the printed marker and lock distinct positions; organizer sees them on the minimap.
3. Battle starts with a synchronized countdown; one participant aims at another and gets target-lock feedback.
4. An attack produces synchronized damage on both phones; a player is eliminated; the same winner shows everywhere.

---

## 12. Open questions
- Marker design: which image maximizes Viro tracking quality at 2–4 m? (Resolve in M0 with A/B of 2–3 candidates.)
- Can a tablet-displayed marker substitute for print reliably, or is print required? (M0.)
- Exact loadout economy for P2 — design after observing real MVP sessions.
- Hosting for Colyseus beyond the hackathon (a $5 VPS is fine for MVP; revisit at M4).
