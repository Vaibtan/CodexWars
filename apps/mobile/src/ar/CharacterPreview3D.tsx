import { useMemo } from "react";
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

function createPreviewScene(selection: CharacterSelection) {
  return function CharacterPreviewScene() {
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
  };
}

export function CharacterPreview3D({ selection }: CharacterPreview3DProps) {
  const scene = useMemo(() => createPreviewScene(selection), [selection]);

  return (
    <View style={styles.frame}>
      <ViroVRSceneNavigator
        key={`${selection.characterId}-${selection.colorId}`}
        autofocus
        initialScene={{ scene }}
        style={styles.navigator}
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
