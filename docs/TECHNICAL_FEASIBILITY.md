# CodexWars P0 — Technical Feasibility and Recommended Stack

**Assessed:** 2026-07-14  
**Inputs:** `PRD.md` v2.3, `BUILD_SPEC.md` v1.3, `ARCHITECTURE.md` v1.1, and `AR_IMPLEMENTATION_SPEC.md`
**Verdict:** **Conditionally feasible for the hackathon vertical slice.** Android+iOS image-marker AR, native Expo development builds, and an authoritative LAN game server are all supported by the selected tools. The project must not be declared feasible until M0 measures real Android-to-iPhone marker alignment and tracking persistence. No official source can guarantee the PRD's 0.30 m / 90 s thresholds in the specific room, marker, lighting, and device mix.

## Final P0 stack

| Concern | Recommendation | Why it fits P0 |
|---|---|---|
| Mobile frontend | **TypeScript 6.0.3 + React 19.2.3 + `@types/react` 19.2.17 + React Native 0.86.0 + Expo SDK 57.0.4 development build**; React Navigation; Zustand for session and local battle UI state | Pins the version produced by Expo's expected `~19.2.4` range and proven by the workspace typecheck. Expo development builds allow native modules; Expo Go does not. Exact native versions remain conditional on the M0 physical-device build. |
| AR / 3D renderer | **`@reactvision/react-viro` 2.57.4**, isolated behind `apps/mobile/src/ar/` | Supplies ARCore-mode Android support, iOS native configuration, image markers, camera transform callbacks, billboarding, images, particles, and GLB rendering. |
| Marker colocation | One bundled, printed, asymmetric A4 image target; `ViroARTrackingTargets` + `ViroARImageMarker`; physical width declared as **0.297 m** | Image markers are explicitly designed to place content relative to a known image. The physical-width input is essential for scale. No cloud anchor is needed. |
| 3D assets / effects | **One bundled default GLB**, rendered by Viro under the marker node; billboard name/HP, bounded pooled bolt/flash effects, and Expo audio/haptics | GLB rendering is P0 presentation only. The server ignores mesh/bone/bounds/height and resolves only a floor-plane ray against canonical 2D player circles. No occlusion or real projectile physics in P0. |
| Multiplayer backend | **Node.js 22.23.1 + TypeScript 6.0.3 + Colyseus 0.17.x**; one authoritative `WarRoom`; shared pure TypeScript combat package | Colyseus rooms provide state synchronization and WebSocket transport; the server can retain the authoritative 2D state and resolve discrete attacks. |
| Mobile multiplayer client | **`@colyseus/sdk` 0.17.43**, paired with **`colyseus` 0.17.10** server | Current Colyseus 0.17 documentation uses this SDK and its automatic reconnection lifecycle. Verify this exact pinned pair in the first networking spike. |
| Multiplayer synchronization | Colyseus schema state at **10 Hz / 100 ms** for lobby, player state, HP, and phase; immediate `attack_resolved` events for combat results; discrete attack commands only | No pose stream is needed. The client keeps aim local and sends a normalized direction only when firing; the server validates cooldown/phase/aliveness and ray-vs-circle hit testing. |
| P0 data store | **None.** Room/player state remains in the single Colyseus process's memory and expires after two idle hours. | This is the stated privacy-minimal P0 requirement. A database would increase scope without supporting the vertical-slice flow. |
| P0 runtime / cloud | **No runtime cloud.** Run Node/Colyseus on the demo laptop, with all phones on the same non-isolated hotspot/LAN. EAS Build is used only to build iOS development/TestFlight binaries. | Keeps the demo independent of venue internet and follows the architecture's local-first topology. |
| Post-P0 persistence | When match history/organizer accounts begin, add **PostgreSQL** (managed or self-hosted) for durable domain data; keep live room state in Colyseus. Add Redis Presence/Driver only when horizontally scaling Colyseus. | Separates transactional/history data from ephemeral, low-latency room state. Neither is a P0 dependency. |

## Evidence and feasibility assessment

### 1. Android and iOS AR with Expo/Viro — feasible, with a device gate

ReactVision's official Expo guide states that ViroReact does **not** run in Expo Go and requires a development client or prebuild plus a rebuild after adding the config plugin. It supports Android `AR` mode (ARCore), iOS permission configuration, and documents support through Expo SDK 57 / React Native 0.86. This matches the checked-in scaffold, but documentation compatibility is not a substitute for installing the Viro plugin and opening the same development-build commit on both target devices. [Viro Expo integration guide](https://viro-community.readme.io/docs/integrating-with-expo)

For Windows development, EAS performs builds on Expo servers and can create iOS builds from non-macOS hosts. A physical iPhone device build still requires paid Apple Developer signing; an iOS Simulator is macOS-only and cannot substitute for this AR test. [Expo development-build documentation](https://docs.expo.dev/develop/development-builds/create-a-build/)

Viro's image-target API registers a source image, orientation, and real-world `physicalWidth`; `ViroARImageMarker` attaches content relative to the found image. Viro also exposes per-frame camera transforms and anchor callbacks, which is sufficient to implement the marker-space adapter described in `ARCHITECTURE.md`. [Viro image targets](https://viro-community.readme.io/docs/viroartrackingtargets) · [image marker API](https://viro-community.readme.io/docs/viroarimagemarker) · [AR scene camera/anchor callbacks](https://viro-community.readme.io/docs/viroarscene)

Android device eligibility remains a real constraint: ARCore certification is device-specific and depends on camera, sensor, design, and CPU checks. iOS must similarly check the intended AR configuration's `isSupported` capability at runtime. P0 must gate entry on an ARCore-certified Android and an ARKit-capable iPhone, then test the exact devices used in the demo. [Google ARCore supported devices](https://developers.google.com/ar/devices) · [Apple ARKit device-support guidance](https://developer.apple.com/documentation/arkit/verifying-device-support-and-user-permission)

**Conclusion:** the APIs exist, but *cross-device spatial accuracy is unproven*. Keep M0 as a hard go/conditional-go/no-go gate. The marker must be print-tested at its declared size, in the intended lighting and at the actual 2–4 m distances. Treat device local tracking as another M0 measurement, not a promise of the marker API.

### 2. GLB rendering plan — feasible and bounded

The selected renderer can track an image, render bundled GLB content in AR, and provide camera pose data. P0 needs one default GLB, labels, a ring, flash/projectile feedback, and a camera-space HUD; it does not need a general 3D game engine. Viro documents billboard transform behavior and native updates that avoid React re-renders for frequent scene changes. [Viro image marker API](https://viro-community.readme.io/docs/viroarimagemarker)

Use these asset budgets:

- GLB: one bundled default avatar, ≤15,000 triangles target (≤25,000 hard cap), ≤4 materials/draw calls, ≤5 MB target (≤8 MB hard cap), with embedded textures.
- Effects: 256–512 px transparent texture atlas for bounded flashes/hits; boundary ring/line and simple visual projectile mesh only.
- Effects: pool a bounded number of particles/flashes; never create an unbounded React tree during battle.
- No depth/occlusion model in P0. ReactVision documents extra setup for non-LiDAR iOS depth features; they are not required by the PRD. [Viro Expo integration guide](https://viro-community.readme.io/docs/integrating-with-expo)

### 3. Authoritative multiplayer on a LAN — feasible

Colyseus is built around server-defined room state synchronized to clients, and its default transport is WebSockets. Its default state patch rate is 50 ms (20 Hz), so the proposed 100 ms/10 Hz state rate is conservative for a 12-player room whose continuous aim data never leaves the device. [Colyseus server overview](https://docs.colyseus.io/server) · [Room API](https://docs.colyseus.io/room)

Creation and joining must use matchmaking before room messages: create a `war` room, assign its unique four-digit custom `roomId` through Presence, and join participants by that ID. The creating connection receives the server-owned organizer role; participants receive participant records in `onJoin`. This removes the need for a separate public-code-to-room registry and prevents clients from claiming organizer authority in a payload. [Colyseus custom room ID recipe](https://docs.colyseus.io/recipes/custom-room-id)

For mobile drops, Colyseus 0.17 provides `onDrop`, `allowReconnection`, `onReconnect`, and `onLeave`; the client SDK automatically retries temporary disconnects. Use a 20-second `allowReconnection` window during battle. Mark the player disconnected on drop, restore only on reconnect, and eliminate/delete only after the grace period reaches `onLeave`. Critically, disable firing while disconnected and discard queued combat inputs so a delayed attack cannot be replayed on reconnection. [Colyseus reconnection guide](https://docs.colyseus.io/room/reconnection)

The LAN design is sound for P0, but it is an operational risk, not a networking feature supplied by Colyseus: devices must use the laptop's **private LAN IP** (not `localhost`), join the same non-client-isolated hotspot, and be allowed through the laptop firewall on the Node port. Rehearse this on both platforms. Colyseus's production guidance confirms ordinary Node deployment with WebSocket Upgrade handling; it does not remove LAN/firewall setup work. [Colyseus deployment guide](https://docs.colyseus.io/deployment)

### 4. Database and cloud — deliberately omitted from P0

The approved specifications require nickname-only, in-memory rooms and deletion on expiry. That is compatible with a single Node process and avoids storing student data. Do not use Firebase/Firestore, Supabase, or a managed database for the P0 battle flow.

For a later hosted product, a single VPS/PaaS Node service needs TLS/WSS, WebSocket-aware ingress, health checks, supervision, observability, abuse throttling, and a client/server compatibility policy. When horizontally scaling room processes, Colyseus requires a shared Presence and Driver; its official scalability guide shows Redis for those roles. Add PostgreSQL only for product data such as organizers, authored quizzes, session history, and consent/retention records—not for 60-second in-progress combat. [Colyseus scalability guide](https://docs.colyseus.io/scalability)

## Locked stack and gates before coding

1. **Normalize and verify the locked baseline:** pin Node 22.23.1 and TypeScript 6.0.3 across workspaces, pin the proven React compatibility set (`react` 19.2.3 / `react-native` 0.86.0 / `@types/react` 19.2.17), remove range operators from load-bearing packages, then use `@colyseus/sdk` 0.17.43 with `colyseus` 0.17.10 in the first networking spike. Expo's expected `~19.2.4` range resolved to 19.2.17; exact 19.2.4 and the pulled 19.2.2 both failed this workspace's React Native JSX typecheck. The active Colyseus 0.17 lifecycle also differs from older `onLeave`-only examples. [Colyseus package versions](https://www.npmjs.com/package/colyseus?activeTab=versions)
2. **Run M0 before feature work:** prove marker detection time, Android-to-iPhone alignment, drift over the camera-on window, marker-loss behavior, and 30 FPS on the intended physical devices. This is the only critical technical uncertainty.
3. **Build iOS on day one:** configure EAS signing, create an iPhone development build, and install it before writing AR gameplay. A paid Apple Developer account and actual ARKit-capable iPhone are P0 dependencies.
4. **Make local networking testable:** add a persisted server URL setting, startup health endpoint, clear connection error, and a rehearsal checklist covering hotspot isolation/firewall behavior.
5. **Keep the renderer bounded:** use the one bundled default GLB and pooled effects only. A Viro regression or M0 colocation failure should permit a later mobile-renderer replacement without changing `packages/shared` or the Colyseus protocol.

## Final feasibility decision

Proceed with the stack above **only after M0 passes on one real Android and one real iPhone**. If it passes or is only marginal, the P0 design (wide hit cones, stationary players, 60-second battle, local server) is practical. If cross-device marker alignment or tracking persistence misses the documented thresholds, AR P0 is not feasible as specified: stop and obtain an explicit revised-product decision rather than building the rest of the app around an unproven spatial layer.
