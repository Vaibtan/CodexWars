import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const previewSourceUrl = new URL("../src/ar/CharacterPreview3D.tsx", import.meta.url);

test("character selection updates do not remount the native Viro navigator", async () => {
  const source = await readFile(previewSourceUrl, "utf8");

  assert.doesNotMatch(
    source,
    /<ViroVRSceneNavigator[\s\S]*?key=/,
    "changing character or color must not change the native navigator identity",
  );
  assert.match(
    source,
    /viroAppProps=\{\{\s*selection\s*\}\}/,
    "selection should flow into the stable scene through viroAppProps",
  );
});
