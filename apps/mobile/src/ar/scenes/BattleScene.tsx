import {
  ViroAmbientLight,
  ViroARScene,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroSphere,
  ViroText,
} from "@reactvision/react-viro";
import { getSceneBridge, type ArSceneProps } from "./sceneBridge";

ViroMaterials.createMaterials({
  opponentCoral: { diffuseColor: "#FF6B7A", lightingModel: "Lambert" },
  opponentBlue: { diffuseColor: "#5E8BFF", lightingModel: "Lambert" },
  opponentViolet: { diffuseColor: "#B875FF", lightingModel: "Lambert" },
  opponentSkin: { diffuseColor: "#FFD2B8", lightingModel: "Lambert" },
  opponentHealth: { diffuseColor: "#6CE5A8", lightingModel: "Constant" },
});

const opponents = [
  { name: "Mira", position: [-1.15, -0.65, -3.4] as [number, number, number], material: "opponentCoral" },
  { name: "Theo", position: [0.2, -0.72, -4.2] as [number, number, number], material: "opponentBlue" },
  { name: "Zed", position: [1.55, -0.68, -3.8] as [number, number, number], material: "opponentViolet" },
];

export function BattleScene(props: ArSceneProps = {}) {
  const bridge = getSceneBridge(props);

  return (
    <ViroARScene onTrackingUpdated={() => bridge?.onTrackingChanged("normal")}>
      <ViroAmbientLight color="#FFFFFF" intensity={210} />
      {opponents.map((opponent) => (
        <ViroNode key={opponent.name} position={opponent.position}>
          <ViroText
            position={[0, 1.42, 0]}
            style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "700", textAlign: "center" }}
            text={opponent.name}
            width={1.2}
          />
          <ViroBox
            height={0.055}
            length={0.04}
            materials={["opponentHealth"]}
            position={[0, 1.23, 0]}
            width={0.72}
          />
          <ViroSphere
            heightSegmentCount={12}
            materials={["opponentSkin"]}
            position={[0, 0.92, 0]}
            radius={0.22}
            widthSegmentCount={12}
          />
          <ViroBox
            height={0.9}
            length={0.3}
            materials={[opponent.material]}
            position={[0, 0.28, 0]}
            width={0.56}
          />
        </ViroNode>
      ))}
    </ViroARScene>
  );
}
