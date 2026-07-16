# CodexWars — AR and GLB Implementation Specification

**Version:** 1.1
**Status:** Authoritative AR/device and asset contract
**Last updated:** 2026-07-16
**Companions:** `PRD.md`, `BUILD_SPEC.md`, `ARCHITECTURE.md`, `API_AND_REALTIME_SPEC.md`

This document owns marker acquisition, marker-space pose conversion, pose freshness, Viro lifecycle, and the bundled GLB catalog. Product rules and wire behavior remain in the root specifications. A rendered model is presentation of server state, never gameplay truth.

## 1. Non-negotiable boundaries

- Only `apps/mobile/src/ar/` may import `@reactvision/react-viro`.
- AR publishes coarse localization, one marker-relative locked X/Z position, and a fresh floor-projected aim direction on attack.
- AR never selects a hit, applies damage, changes HP/shield, or decides a winner.
- The server and shared packages never import a GLB, Viro type, camera matrix, or mobile asset handle.
- Expo Go is unsupported because Viro is native code. Use an installed development/production build.

## 2. Shared marker origin

P0 colocation requires one bundled, printed, asymmetric image marker placed flat at arena center.

1. Register the marker with `ViroARTrackingTargets` at its measured physical width.
2. Acquire it through `ViroARImageMarker`.
3. Retain the marker transform `T_marker` for the complete localization → positioning → battle AR session.
4. Derive local camera position and forward direction in marker space.
5. Render synchronized actors under that same marker transform.

```text
marker-space camera position = inverse(T_marker) × local camera position
marker-space aim direction  = normalize(projectXZ(inverse(rotation(T_marker)) × cameraForward))
actor render transform      = T_marker × [player.positionX, yOffset, player.positionZ]
```

The navigator/AR world that captured `T_marker` must not be destroyed between position lock and battle. Recreating a Viro navigator creates an unrelated local origin and invalidates synchronized X/Z rendering.

### Current implementation

- `apps/mobile/assets/arena-marker.png` is the runtime target. `apps/mobile/src/ar/arenaMarker.ts` registers it as a 0.18 m image target.
- `output/pdf/codexwars-arena-marker-a4.pdf` is the A4 print master. Print at 100% / Actual size and verify the black square is exactly 180 mm wide.
- `SharedArenaScene` owns marker acquisition, anchor updates, camera-pose capture, marker-local actor rendering, and tracking loss.
- `coordinates.ts` converts world camera position/forward into marker space and rejects vertical or poses older than one second.
- `ParticipantArenaScreen` retains one `ViroARSceneNavigator` while its positioning/waiting/battle overlays change.

The implementation portion of M0 is complete. M0 itself remains open until the physical measurements in section 7 pass on Android and iPhone; a successful build is not measurement evidence.

## 3. Tracking and aim freshness

Coarse state sent to the server is `searching | localized | lost`. High-frequency transforms remain on-device.

- Before battle, losing localization clears readiness.
- During battle, the server retains the locked position. The mobile app permits firing from tracked or degraded/last-known marker tracking only while a new marker-relative pose remains fresh; marker removal, stale pose, or unavailable world tracking disables firing.
- A cached direction older than 1 second must not be sent.
- Project camera forward onto X/Z. If its magnitude is below `0.1`, disable fire and show “aim level.”
- The client-predicted target may drive highlighting only. The server ignores it for authority.

`ParticipantBattleScreen` reads the latest marker-space camera-forward vector and uses `resolveBoltAttack` only for local target highlighting. The discrete attack request contains the fresh direction; the server remains authoritative and may resolve a miss or a different target.

## 4. Bundled character catalog

P0 ships three cosmetic characters and four color variants. New players may temporarily carry `characterId="default"`; clients render that as the catalog fallback until selection.

```ts
type CharacterId = "default" | "knight" | "ninja" | "wizard";
type CharacterColorId = "gold" | "coral" | "aqua" | "violet";
```

Runtime assets live in `assets/characters/runtime/`:

```text
knight-{gold,coral,aqua,violet}.glb
ninja-{gold,coral,aqua,violet}.glb
wizard-{gold,coral,aqua,violet}.glb
```

`apps/mobile/src/features/characters/characterCatalog.ts` is the only filename/scale lookup. Screens and protocol messages use approved IDs, never asset URLs. The server validates both IDs and synchronizes them in `PlayerPublicState`.

Character/color choice is cosmetic. Every variant uses the same `PLAYER_HIT_RADIUS_M`, HP, shield, Bolt range, damage, and cooldown.

## 5. Asset acceptance

Each admitted GLB must:

- be self-contained binary glTF 2.0 with no external buffers or textures;
- have consistent upright orientation, forward direction, and metre-scale authoring;
- load from a Metro `require()` on Android and iOS;
- avoid gameplay dependencies on mesh bounds, bones, materials, or animation names;
- stay within 25,000 rendered triangles, four materials/draw calls where practical, 1024 px maximum texture maps, and 8 MB hard file size;
- remain readable at the catalog's fixed render scale;
- fail to a visual placeholder without changing gameplay state.

Target at least 30 FPS with the maximum visible combat cohort on the designated mid-range Android and iPhone. Measure rather than infer performance from desktop tooling.

## 6. Rendering rules

- Render an opponent only from synchronized `combatIncluded`, `positionLocked`, position, appearance, HP, and elimination fields.
- Billboard name and health UI toward the local camera.
- Reconcile all persistent HP/shield/elimination visuals to Schema state.
- Trigger one-shot hit effects only from validated authoritative events; local prediction never persists damage.
- Eliminated actors may fade or play an effect, but remain non-interactive.
- Do not upload or stream camera frames.

`SharedArenaScene` renders synchronized actors as children of `ViroARImageMarker`, so every network X/Z coordinate is interpreted in the marker's local frame. Authoritative transient hit effects remain follow-up presentation work.

## 7. M0 device gate

Use one physical ARCore-capable Android phone and one physical ARKit-capable iPhone with the same commit and marker.

| Measurement | Pass |
|---|---:|
| Marker acquisition, 10 trials/device | median ≤10 s; p90 ≤20 s |
| Cross-device virtual-point agreement at 3 m | ≤0.30 m |
| Aim-relevant heading error | ≤8° |
| Additional drift across a 3-minute camera session | ≤0.30 m |
| Stale-pose fire shutdown | ≤1 s |
| Enabled GLB variants | all load on both platforms without a crash |

Record measured results in `M0_RESULTS.md`. A plane-only demo, Expo Doctor pass, emulator launch, or single-platform run is not M0 evidence.

## 8. Explicit non-goals

- Cloud anchors or hosted spatial services.
- Camera upload, face/body recognition, or real-person tracking.
- Full 3D physics or GLB-driven hitboxes.
- Arbitrary/user-uploaded models or remote asset URLs.
- Character-specific combat advantages.
- Expo Go compatibility while Viro remains in the app.
