import { useState } from "react";
import {
  Viro3DObject,
  ViroAmbientLight,
  ViroARPlane,
  ViroARScene,
  ViroMaterials,
  ViroNode,
  ViroQuad,
  ViroSphere,
  ViroText,
} from "@reactvision/react-viro";
import { getCharacter, getCharacterSource } from "../../features/characters/characterCatalog";
import type { ArenaPosition } from "../../features/characters/types";
import { getSceneBridge, mapViroTrackingState, type ArSceneProps } from "./sceneBridge";

ViroMaterials.createMaterials({
  placementRing: { diffuseColor: "#FFFFFF", lightingModel: "Constant" },
  previewGlow: { diffuseColor: "#5DE2D7", lightingModel: "Constant" },
});

type ViroPosition = [number, number, number];

export function CharacterPlacementScene(props: ArSceneProps = {}) {
  const bridge = getSceneBridge(props);
  const [placement, setPlacement] = useState<ViroPosition | null>(null);
  const selection = bridge?.characterSelection;
  const character = selection ? getCharacter(selection.characterId) : null;

  const placeCharacter = (position: ViroPosition) => {
    const floorPosition: ViroPosition = [position[0], position[1] + 0.01, position[2]];
    const arenaPosition: ArenaPosition = {
      x: Number(position[0].toFixed(2)),
      z: Number(position[2].toFixed(2)),
    };
    setPlacement(floorPosition);
    bridge?.onPlacementChanged?.(arenaPosition);
  };

  return (
    <ViroARScene
      onTrackingUpdated={(state) => bridge?.onTrackingChanged(mapViroTrackingState(state))}
    >
      <ViroAmbientLight color="#FFFFFF" intensity={220} />
      {!placement && character && selection ? (
        <ViroNode position={[0, -0.55, -2]}>
          <ViroSphere
            materials={["previewGlow"]}
            opacity={0.5}
            radius={0.52}
            scale={[1, 0.035, 1]}
            widthSegmentCount={24}
          />
          <Viro3DObject
            opacity={0.78}
            position={[0, 0.03, 0]}
            scale={[...character.scale]}
            source={getCharacterSource(selection.characterId, selection.colorId)}
            type="GLB"
          />
          <ViroText
            position={[0, 1.55, 0]}
            style={{ color: "#5DE2D7", fontSize: 24, fontWeight: "700", textAlign: "center" }}
            text="TAP A FLOOR TO PLACE"
            transformBehaviors={["billboardY"]}
            width={2}
          />
        </ViroNode>
      ) : null}
      <ViroARPlane alignment="Horizontal" minHeight={0.5} minWidth={0.5}>
        <ViroNode onClick={placeCharacter}>
          <ViroQuad
            height={4}
            materials={[placement ? "placementRing" : "previewGlow"]}
            opacity={placement ? 0.01 : 0.08}
            position={[0, 0.004, 0]}
            rotation={[-90, 0, 0]}
            width={4}
          />
        </ViroNode>
      </ViroARPlane>
      {placement && character && selection ? (
        <>
          <ViroSphere
            materials={["placementRing"]}
            opacity={0.72}
            position={placement}
            radius={0.46}
            scale={[1, 0.035, 1]}
            widthSegmentCount={24}
          />
          <Viro3DObject
            position={[placement[0], placement[1] + 0.02, placement[2]]}
            scale={[...character.scale]}
            source={getCharacterSource(selection.characterId, selection.colorId)}
            type="GLB"
          />
          <ViroText
            position={[placement[0], placement[1] + 1.65, placement[2]]}
            style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "700", textAlign: "center" }}
            text="YOUR POSITION"
            transformBehaviors={["billboardY"]}
            width={1.5}
          />
        </>
      ) : null}
    </ViroARScene>
  );
}
