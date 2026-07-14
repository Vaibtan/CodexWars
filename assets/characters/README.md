# Runtime character assets

Only optimized `.glb` files in `runtime/` are version-controlled. These are the
assets React Native will load in the AR scene.

The downloaded Quaternius archive, Blender sources, FBX, OBJ, glTF authoring
exports, previews, and other working files remain local and are ignored by Git.
The current participant catalog contains `knight`, `ninja`, and `wizard`, with
pre-baked `gold`, `coral`, `aqua`, and `violet` outfit variants. Runtime files
use `runtime/<character-id>-<color-id>.glb`; the app synchronizes those two IDs
rather than a raw path or model payload.

Customize source models in Blender, export the approved mobile-ready variant as
GLB, and add it with the same naming contract. Every exported variant must keep
the original skeleton and `Idle` animation.

Follow the asset and AR contract in
[`docs/AR_IMPLEMENTATION_SPEC.md`](../../docs/AR_IMPLEMENTATION_SPEC.md).
