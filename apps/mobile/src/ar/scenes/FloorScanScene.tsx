import { useRef } from "react";
import {
  ViroAmbientLight,
  ViroARPlane,
  ViroARScene,
  ViroMaterials,
  ViroQuad,
  ViroText,
  ViroTrackingStateConstants,
} from "@reactvision/react-viro";
import type { ArTrackingState } from "../types";
import { getSceneBridge, type ArSceneProps } from "./sceneBridge";

ViroMaterials.createMaterials({
  arenaFloorFound: {
    diffuseColor: "#FFCC4D",
    transparency: 0.58,
  },
});

function mapTrackingState(state: number): ArTrackingState {
  if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
    return "normal";
  }
  if (state === ViroTrackingStateConstants.TRACKING_LIMITED) {
    return "limited";
  }
  return "unavailable";
}

export function FloorScanScene(props: ArSceneProps = {}) {
  const floorReported = useRef(false);
  const bridge = getSceneBridge(props);

  const handleFloorFound = () => {
    if (floorReported.current) {
      return;
    }
    floorReported.current = true;
    bridge?.onFloorFound();
  };

  return (
    <ViroARScene
      onTrackingUpdated={(state) => bridge?.onTrackingChanged(mapTrackingState(state))}
    >
      <ViroAmbientLight color="#FFFFFF" intensity={180} />
      <ViroARPlane minHeight={0.5} minWidth={0.5} onAnchorFound={handleFloorFound}>
        <ViroQuad
          height={1.4}
          materials={["arenaFloorFound"]}
          position={[0, 0.005, 0]}
          rotation={[-90, 0, 0]}
          width={1.4}
        />
        <ViroText
          position={[0, 0.03, 0]}
          rotation={[-90, 0, 0]}
          style={{ color: "#10162F", fontSize: 24, fontWeight: "700", textAlign: "center" }}
          text="ARENA FLOOR"
          width={1.2}
        />
      </ViroARPlane>
    </ViroARScene>
  );
}
