import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const customizationSourceUrl = new URL(
  "../src/screens/CharacterCustomizationScreen.tsx",
  import.meta.url,
);
const organizerSourceUrl = new URL("../src/ar/ArDemoScreen.tsx", import.meta.url);
const placementSourceUrl = new URL(
  "../src/screens/ParticipantPlacementScreen.tsx",
  import.meta.url,
);
const placementNavigatorSourceUrl = new URL(
  "../src/ar/ParticipantPlacementArView.tsx",
  import.meta.url,
);
const placementSceneSourceUrl = new URL(
  "../src/ar/scenes/CharacterPlacementScene.tsx",
  import.meta.url,
);

test("leaving character customization does not recycle a native Viro preview", async () => {
  const source = await readFile(customizationSourceUrl, "utf8");

  assert.doesNotMatch(
    source,
    /CharacterPreview3D/,
    "the customization-to-placement transition must not unmount a Viro navigator",
  );
});

test("organizer phase changes preserve one native AR navigator", async () => {
  const source = await readFile(organizerSourceUrl, "utf8");
  assert.equal(source.match(/<ViroARSceneNavigator/g)?.length, 1);
  assert.doesNotMatch(source, /key=\{phase\}/);
});

test("participant waiting overlay preserves the placement navigator", async () => {
  const source = await readFile(placementSourceUrl, "utf8");
  const waitingBranch = source.slice(source.indexOf("if (waiting)"), source.indexOf("const canJoin"));
  assert.match(waitingBranch, /<ParticipantPlacementArView/);
});

test("participant selection does not remount the placement navigator", async () => {
  const source = await readFile(placementNavigatorSourceUrl, "utf8");
  assert.doesNotMatch(source, /<ViroARSceneNavigator[\s\S]*?key=/);
});

test("AR placement does not pass the incompatible onClick prop to ViroQuad", async () => {
  const source = await readFile(placementSceneSourceUrl, "utf8");
  const quad = source.match(/<ViroQuad[\s\S]*?\/>/)?.[0] ?? "";

  assert.doesNotMatch(quad, /onClick=/);
  assert.match(source, /<ViroARPlane[^>]*onClick=\{placeCharacter\}/);
});
