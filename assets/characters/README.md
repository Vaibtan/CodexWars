# Runtime character assets

Only optimized `.glb` files in `runtime/` are version-controlled. These are the
assets React Native will load in the AR scene.

The downloaded Quaternius archive, Blender sources, FBX, OBJ, glTF authoring
exports, previews, and other working files remain local and are ignored by Git.
The repository currently records the source only as a Quaternius archive.
Before external distribution, record the exact pack URL/version and its asset
licence with the local authoring material; do not infer a pack licence from the
modelling tool or a different Quaternius pack. Only optimized runtime
derivatives are committed here.
The current participant catalog contains `knight`, `ninja`, and `wizard`, with
pre-baked `gold`, `coral`, `aqua`, and `violet` outfit variants. Runtime files
use `runtime/<character-id>-<color-id>.glb`; the app synchronizes those two IDs
rather than a raw path or model payload.

Customize source models in Blender, export the approved mobile-ready variant as
GLB, and add it with the same naming contract. Every exported variant must keep
the original skeleton and `Idle` animation.

Follow the asset and AR contract in
[`docs/AR_IMPLEMENTATION_SPEC.md`](../../docs/AR_IMPLEMENTATION_SPEC.md).
