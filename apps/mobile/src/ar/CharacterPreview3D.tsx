import type { JSX } from "react";
import { StyleSheet, View } from "react-native";
import {
  Viro3DObject,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroScene,
  ViroVRSceneNavigator,
} from "@reactvision/react-viro";
import { getCharacter, getCharacterSource } from "../features/characters/characterCatalog";
import type { CharacterSelection } from "../features/characters/types";
import { colors } from "../components/theme";

type CharacterPreview3DProps = {
  selection: CharacterSelection;
};

type CharacterPreviewSceneProps = {
  sceneNavigator?: {
    viroAppProps?: {
      selection?: CharacterSelection;
    };
  };
};

function CharacterPreviewScene({ sceneNavigator }: CharacterPreviewSceneProps) {
  const selection = sceneNavigator?.viroAppProps?.selection;

  if (!selection) {
    return <ViroScene />;
  }

  const character = getCharacter(selection.characterId);

  return (
    <ViroScene>
      <ViroAmbientLight color="#FFFFFF" intensity={260} />
      <ViroDirectionalLight color="#FFF1C9" direction={[-1, -1, -0.5]} intensity={180} />
      <Viro3DObject
        animation={{ loop: true, name: "Idle", run: true }}
        position={[0, -1.05, -2.6]}
        rotation={[0, 16, 0]}
        scale={[...character.scale]}
        source={getCharacterSource(selection.characterId, selection.colorId)}
        type="GLB"
      />
    </ViroScene>
  );
}

// Viro supplies `sceneNavigator` at runtime, but its TypeScript declaration only
// accepts an argument-less scene factory. Keep that declaration mismatch at this
// native boundary; the scene reads the current selection from `viroAppProps`.
const previewInitialScene = {
  scene: CharacterPreviewScene as unknown as () => JSX.Element,
};

export function CharacterPreview3D({ selection }: CharacterPreview3DProps) {
  return (
    <View style={styles.frame}>
      <ViroVRSceneNavigator
        autofocus
        initialScene={previewInitialScene}
        style={styles.navigator}
        viroAppProps={{ selection }}
        vrModeEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.backgroundRaised,
    borderRadius: 16,
    height: 220,
    overflow: "hidden",
    width: 176,
  },
  navigator: { flex: 1 },
});
