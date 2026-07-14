# Runtime character assets

Only optimized `.glb` files in `runtime/` are version-controlled. These are the
assets React Native will load in the AR scene.

The downloaded Quaternius archive, Blender sources, FBX, OBJ, glTF authoring
exports, previews, and other working files remain local and are ignored by Git.
Customize source models in Blender, export the approved mobile-ready variant as
GLB, and add it under `runtime/<character-id>/<variant>.glb`.

Follow the asset and AR contract in
[`docs/AR_IMPLEMENTATION_SPEC.md`](../../docs/AR_IMPLEMENTATION_SPEC.md).
