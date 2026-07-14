# CodexWars P0 — Technical Feasibility and Recommended Stack

**Assessed:** 2026-07-14  
**Status:** Dated decision evidence; not an implementation source of truth
**Inputs:** `PRD.md`, `BUILD_SPEC.md`, `ARCHITECTURE.md`, `API_AND_REALTIME_SPEC.md`, and `AR_IMPLEMENTATION_SPEC.md`
**Verdict:** **Conditionally feasible for the hackathon vertical slice.** Android+iOS image-marker AR, native Expo development builds, and an authoritative LAN game server are all supported by the selected tools. The project must not be declared feasible until M0 measures real Android-to-iPhone marker alignment and tracking persistence. No official source can guarantee the PRD's 0.30 m / 90 s thresholds in the specific room, marker, lighting, and device mix.

The active stack and requirements are defined elsewhere; this file records only the external evidence behind the feasibility verdict.

## Evidence

### 1. Android and iOS AR with Expo/Viro — feasible, with a device gate

ReactVision's official Expo guide states that ViroReact does **not** run in Expo Go and requires a development client or prebuild plus a rebuild after adding the config plugin. It supports Android `AR` mode (ARCore), iOS permission configuration, and documents support through Expo SDK 57 / React Native 0.86. This matches the checked-in scaffold, but documentation compatibility is not a substitute for installing the Viro plugin and opening the same development-build commit on both target devices. [Viro Expo integration guide](https://viro-community.readme.io/docs/integrating-with-expo)

For Windows development, EAS performs builds on Expo servers and can create iOS builds from non-macOS hosts. A physical iPhone device build still requires paid Apple Developer signing; an iOS Simulator is macOS-only and cannot substitute for this AR test. [Expo development-build documentation](https://docs.expo.dev/develop/development-builds/create-a-build/)

Viro's image-target API registers a source image, orientation, and real-world `physicalWidth`; `ViroARImageMarker` attaches content relative to the found image. Viro also exposes per-frame camera transforms and anchor callbacks, which is sufficient to implement the marker-space adapter described in `ARCHITECTURE.md`. [Viro image targets](https://viro-community.readme.io/docs/viroartrackingtargets) · [image marker API](https://viro-community.readme.io/docs/viroarimagemarker) · [AR scene camera/anchor callbacks](https://viro-community.readme.io/docs/viroarscene)

Android device eligibility remains a real constraint: ARCore certification is device-specific and depends on camera, sensor, design, and CPU checks. iOS must similarly check the intended AR configuration's `isSupported` capability at runtime. P0 must gate entry on an ARCore-certified Android and an ARKit-capable iPhone, then test the exact devices used in the demo. [Google ARCore supported devices](https://developers.google.com/ar/devices) · [Apple ARKit device-support guidance](https://developer.apple.com/documentation/arkit/verifying-device-support-and-user-permission)

**Conclusion:** the APIs exist, but *cross-device spatial accuracy is unproven*. Keep M0 as a hard go/conditional-go/no-go gate. The marker must be print-tested at its declared size, in the intended lighting and at the actual 2–4 m distances. Treat device local tracking as another M0 measurement, not a promise of the marker API.

### 2. GLB rendering plan — feasible and bounded

The selected renderer can track an image, render bundled GLB content in AR, and provide camera pose data. P0 needs one default GLB, labels, a ring, flash/projectile feedback, and a camera-space HUD; it does not need a general 3D game engine. Viro documents billboard transform behavior and native updates that avoid React re-renders for frequent scene changes. [Viro image marker API](https://viro-community.readme.io/docs/viroarimagemarker)

The enforceable asset budgets and rendering constraints live only in `AR_IMPLEMENTATION_SPEC.md`. ReactVision documents additional setup for non-LiDAR depth features; that evidence supports keeping depth/occlusion outside P0. [Viro Expo integration guide](https://viro-community.readme.io/docs/integrating-with-expo)

### 3. Authoritative multiplayer on a LAN — feasible

Colyseus is built around server-defined room state synchronized to clients, and its default transport is WebSockets. Its default state patch rate is 50 ms (20 Hz), so the proposed 100 ms/10 Hz state rate is conservative for a 12-player room whose continuous aim data never leaves the device. [Colyseus server overview](https://docs.colyseus.io/server) · [Room API](https://docs.colyseus.io/room)

Colyseus exposes custom room IDs, matchmaking, synchronized room state, and reconnection lifecycle hooks required by the P0 contract. Exact behavior and grace periods live only in `API_AND_REALTIME_SPEC.md`. [Colyseus custom room ID recipe](https://docs.colyseus.io/recipes/custom-room-id) · [Colyseus reconnection guide](https://docs.colyseus.io/room/reconnection)

The LAN design is sound for P0, but it is an operational risk, not a networking feature supplied by Colyseus: devices must use the laptop's **private LAN IP** (not `localhost`), join the same non-client-isolated hotspot, and be allowed through the laptop firewall on the Node port. Rehearse this on both platforms. Colyseus's production guidance confirms ordinary Node deployment with WebSocket Upgrade handling; it does not remove LAN/firewall setup work. [Colyseus deployment guide](https://docs.colyseus.io/deployment)

### 4. Database and cloud — deliberately omitted from P0

The approved specifications require nickname-only, in-memory rooms and deletion on expiry. That is compatible with a single Node process and avoids storing student data. Do not use Firebase/Firestore, Supabase, or a managed database for the P0 battle flow.

For a later hosted product, a single VPS/PaaS Node service needs TLS/WSS, WebSocket-aware ingress, health checks, supervision, observability, abuse throttling, and a client/server compatibility policy. When horizontally scaling room processes, Colyseus requires a shared Presence and Driver; its official scalability guide shows Redis for those roles. Add PostgreSQL only for product data such as organizers, authored quizzes, session history, and consent/retention records—not for 60-second in-progress combat. [Colyseus scalability guide](https://docs.colyseus.io/scalability)

## Feasibility boundary

Proceed with the stack above **only after M0 passes on one real Android and one real iPhone**. If it passes or is only marginal, the P0 design (wide hit cones, stationary players, 60-second battle, local server) is practical. If cross-device marker alignment or tracking persistence misses the documented thresholds, AR P0 is not feasible as specified: stop and obtain an explicit revised-product decision rather than building the rest of the app around an unproven spatial layer.
