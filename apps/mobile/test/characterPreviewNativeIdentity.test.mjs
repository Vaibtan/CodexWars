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
const placementSceneSourceUrl = new URL(
  "../src/ar/scenes/CharacterPlacementScene.tsx",
  import.meta.url,
);
const participantArenaViewSourceUrl = new URL(
  "../src/ar/ParticipantArenaArView.tsx",
  import.meta.url,
);
const sharedArenaSceneSourceUrl = new URL(
  "../src/ar/scenes/SharedArenaScene.tsx",
  import.meta.url,
);
const participantArenaScreenSourceUrl = new URL(
  "../src/screens/ParticipantArenaScreen.tsx",
  import.meta.url,
);
const appSourceUrl = new URL("../App.tsx", import.meta.url);
const homeSourceUrl = new URL("../src/screens/HomeScreen.tsx", import.meta.url);
const storySourceUrl = new URL("../src/screens/DemoStoryScreen.tsx", import.meta.url);

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
  assert.match(source, /initialScene=\{\{ scene: SharedArenaScene \}\}/);
  assert.doesNotMatch(source, /FloorScanScene|generic floor plane|Use floor/);
});

test("participant overlays do not own or recycle the native AR navigator", async () => {
  const source = await readFile(placementSourceUrl, "utf8");
  assert.doesNotMatch(source, /ViroARSceneNavigator|ParticipantPlacementArView/);
});

test("AR placement does not pass the incompatible onClick prop to ViroQuad", async () => {
  const source = await readFile(placementSceneSourceUrl, "utf8");
  const quad = source.match(/<ViroQuad[\s\S]*?\/>/)?.[0] ?? "";

  assert.doesNotMatch(quad, /onClick=/);
  assert.doesNotMatch(quad, /onClickState=/);
  assert.match(source, /<ViroNode onClick=\{placeCharacter\}>/);
});

test("the authoritative app flow uses the imported participant and organizer screens", async () => {
  const source = await readFile(appSourceUrl, "utf8");
  assert.match(source, /<OrganizerDashboardScreen/);
  assert.match(source, /<ParticipantQuizScreen/);
  assert.match(source, /<ParticipantQuizResultsScreen/);
});

test("battle AR renders synchronized character assets instead of hard-coded opponents", async () => {
  const source = await readFile(sharedArenaSceneSourceUrl, "utf8");

  assert.match(source, /bridge\?\.battleActors/);
  assert.match(source, /<Viro3DObject/);
  assert.match(source, /getCharacterSource/);
  assert.doesNotMatch(source, /const opponents =/);
});

test("participant placement and battle retain one marker-anchored native AR session", async () => {
  const arenaViewSource = await readFile(participantArenaViewSourceUrl, "utf8");
  const sharedSceneSource = await readFile(sharedArenaSceneSourceUrl, "utf8");

  assert.equal(arenaViewSource.match(/<ViroARSceneNavigator/g)?.length, 1);
  assert.match(sharedSceneSource, /<ViroARImageMarker/);
  assert.match(sharedSceneSource, /onCameraTransformUpdate=/);
  assert.match(sharedSceneSource, /bridge\?\.phase === "battle"/);
});

test("the app keeps the participant arena shell mounted across positioning and battle", async () => {
  const appSource = await readFile(appSourceUrl, "utf8");
  const arenaScreenSource = await readFile(participantArenaScreenSourceUrl, "utf8");

  assert.equal(appSource.match(/<ParticipantArenaScreen/g)?.length, 1);
  assert.match(appSource, /screen === "participant-placement" \|\| screen === "participant-battle"/);
  assert.equal(arenaScreenSource.match(/<ParticipantArenaArView/g)?.length, 1);
  assert.match(arenaScreenSource, /mode === "battle"/);
});

test("the home screen opens the native story demo", async () => {
  const appSource = await readFile(appSourceUrl, "utf8");
  const homeSource = await readFile(homeSourceUrl, "utf8");
  const storySource = await readFile(storySourceUrl, "utf8");

  assert.match(appSource, /screen === "demo-story"/);
  assert.match(appSource, /onShowDemo=\{\(\) => setScreen\("demo-story"\)\}/);
  assert.match(homeSource, /Watch the CodexWars demo/);
  assert.match(storySource, /STORY_DURATION_MS = 6_000/);
  assert.match(storySource, /accessibilityActions=/);
});
