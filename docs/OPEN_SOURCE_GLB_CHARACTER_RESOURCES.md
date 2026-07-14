# Open-source character resources for CodexWars

**Research date:** 2026-07-14
**Decision:** start with **Quaternius Universal Base Characters** for the P1
roster, then use a **MakeHuman + MPFB + Blender** pipeline only if the product
needs more body/face variation. Export a small, pre-baked GLB for each
supported combination; do not attempt to create or rig an avatar on a phone
during a match.

This fits CodexWars' roadmap: P0 renders one bundled default GLB and makes
character choice and colour a P1 feature. AR is presentation only; the server
continues to own the participant's selected avatar/colour and all battle state.

## Recommended sources and tools

| Resource | What it provides | Licence / shipping implication | GLB and customisation fit | Verdict |
| --- | --- | --- | --- | --- |
| [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | Six game-ready superhero, regular, and teen-proportion base models; 20 mix-and-match hairstyles; a humanoid rig; optimized animation-friendly topology. | CC0: the page permits personal, educational, and commercial use without attribution requirements. | Ships in `.glTF` as well as FBX, with a reported average of 13k triangles. The source version documents customizable eye and skin colors plus Blender source files, so it directly supports the colour/hair approach in this project. Export final variants as `.glb` in Blender. | **Best immediate choice for CodexWars.** It is the closest fit for a stylized, low-risk P1 roster. |
| [MakeHuman](https://www.makehumancommunity.org/) + [MPFB](https://static.makehumancommunity.org/mpfb.html) | Parametric human base meshes and a Blender pipeline. MPFB can create game-engine, CMU MB, Mixamo, Rigify, or custom rigs; it attaches clothing/body assets after creating the rig. | MakeHuman source is AGPL and MPFB source is GPL, but MakeHuman says its core graphic assets and exported models are CC0. Community add-ons/assets can have their own licence and must be checked individually. | MakeHuman itself exports FBX/DAE/OBJ, not GLB. Send the character through Blender, whose glTF exporter makes `.glb` and supports PBR materials, skins, and keyframe/shape-key animation. | **Best long-term choice.** Use only CC0 core assets for the first roster; make colour and accessory options from your own material slots and attachments. |
| [Kenney Animated Characters Protagonists](https://kenney.nl/assets/animated-characters-protagonists), [Retro](https://kenney.nl/assets/animated-characters-retro), and [Survivors](https://kenney.nl/assets/animated-characters-survivors) | Three small, stylised 3D animated-character packs, each with eight files. Good for a fast, readable battle-game style. | The pack pages mark each as CC0. | Convert the supplied source model(s) to GLB in Blender and split/name meshes/materials for the options we need. This is a **pre-production conversion**, not a claim that the downloads are ready-made GLBs. | **Best hackathon shortcut.** Pick one visual family, make a small set of colour variants, and validate its rig/animations after conversion. |
| [CharMorph](https://github.com/Upliner/CharMorph) with its [character licence chart](https://blendercharacterproject.org/docs/html/Introduction.html) | An active Blender character-creation add-on with modular character libraries. Its documented library includes the CC0 **Vitruvian** character, plus CC-BY and AGPL characters. | CharMorph code is GPL. The content is not uniformly licensed: Vitruvian is CC0, Antonia/Reom are CC-BY, MB-Lab is AGPL. | Author in Blender, then use the Blender GLB exporter. CharMorph release notes describe facial-expression shape keys and a gaming/Rigify rig, which are useful authoring inputs but must be tested in the chosen mobile renderer after export. | **Good alternative** when the team wants a Blender-native customizer. Start only with Vitruvian (CC0), not the mixed-licence library. |
| [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Models.md) | Direct downloadable GLBs for loader and asset-pipeline testing, including animated/skinned examples. | Licence is per asset, not repository-wide. For example, Cesium Man is CC-BY with trademark limitations. | Excellent to test whether our AR renderer loads a particular GLB feature (skins, animation, materials). It is not a customizable avatar catalogue. | **Use for technical tests only**, unless the selected asset's individual licence and branding are acceptable. |

## Recommended production path

1. Start with the CC0 Quaternius Universal Base Characters kit; use MakeHuman/
   MPFB only if the roadmap requires a more parametric human creator. Keep an
   editable `.blend` source as the canonical asset.
2. Give the model stable names: `Body`, `Hair`, `Top`, `Bottom`, `Eyes`, and
   `Accessory_*`. Use separate material slots such as `MAT_SKIN`, `MAT_TOP`,
   and `MAT_HAIR`.
3. Make the P1 options deliberately small: 4–6 shirt colours, 3 hair colours,
   and 2–3 accessory meshes. Export either (a) a GLB per approved variant or
   (b) a GLB with named meshes/materials if the React Native AR renderer can
   reliably override them. Prefer **(a)** for the hackathon: it is deterministic
   across Android and iOS.
4. Use one game-friendly skeleton and bake the required clips into each GLB:
   `idle`, `hit`, `cast`, and `eliminated`. An animation rig must match the
   model; MakeHuman's own docs distinguish rig/BVH export from model-animation
   export, so retarget and bake in Blender rather than expecting an animation
   to work unmodified.
5. Optimize only after correctness is verified. [glTF Transform](https://github.com/donmccurdy/glTF-Transform)
   is MIT-licensed and can read/write GLB, deduplicate/prune, apply Meshopt or
   Draco, resize textures, and create WebP/KTX2/Basis textures. Confirm the
   final React Viro/ARKit/ARCore loading path supports any compression selected.

## Runtime selection contract

Store selection as data, rather than trusting a client-supplied remote model:

```ts
type AvatarSelection = {
  avatarId: 'kenney-protagonist-01';
  variantId: 'blue-cap';
  glbAssetKey: 'avatars/kenney-protagonist-01-blue-cap.glb';
  animationSet: 'humanoid-v1';
};
```

The server validates `avatarId` and `variantId` against an allow-list and
broadcasts the resolved `glbAssetKey`. Each AR client loads that same bundled
or signed asset, then anchors it at the player's marker-relative position. This
preserves the PRD's server-authoritative game model while letting colour remain
visible and consistent to every player.

## Acceptance checks before adopting an asset

- Verify the **asset** licence, attribution, redistribution terms, and any
  trademark restriction; tool/source-code licences do not automatically answer
  asset licensing.
- Open the exported GLB in a glTF validator/viewer and on one physical Android
  and one physical iPhone AR build.
- Verify the four required clips, scale in metres, upright orientation, and
  that all texture URLs are embedded or packaged correctly.
- Load 4–12 copies in the intended arena scene, because CodexWars targets up to
  12 participants. Profile frame time and thermal behaviour before enabling a
  richer avatar set.

## Primary-source notes

- [MakeHuman's licence page](https://static.makehumancommunity.org/about/license.html)
  covers the AGPL application and CC0 core graphic assets; its [commercial
  export FAQ](https://static.makehumancommunity.org/makehuman/faq/can_i_sell_models_created_with_makehuman.html)
  explicitly says exported models are CC0.
- [MPFB's randomization/creation documentation](https://static.makehumancommunity.org/mpfb/docs/randomization/creation.html)
  describes its rig alternatives and matching sub-rigs for attached assets.
  The official [clothing walkthrough](https://static.makehumancommunity.org/relatedsystems/godot/tomcat/tomcat1.html)
  demonstrates clothes, shoes, and sunglasses.
- [MakeHuman export formats](https://static.makehumancommunity.org/makehuman/docs/exports_and_file_formats.html)
  and the official [MakeHuman-to-Blender pipeline](https://static.makehumancommunity.org/oldsite/faq/how_do_i_export_assets_from_makehuman_to_blender.html)
  establish the conversion path. The [Blender glTF documentation](https://docs.blender.org/manual/en/3.3/addons/import_export/scene_gltf2.html)
  documents `.glb` export, materials, skinning, and supported animation types.
- [Kenney's pack pages](https://kenney.nl/assets/animated-characters-protagonists)
  state both their 3D animated-character category and CC0 licence.
- [Quaternius' Universal Base Characters page](https://quaternius.com/packs/universalbasecharacters.html)
  states its CC0 licence, `.glTF` delivery, humanoid rig, 20 mix-and-match
  hairstyles, customizable eye/skin colour source, and roughly 13k-triangle
  average character budget.
