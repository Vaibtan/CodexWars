import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { CharacterPlacementScene } from "./scenes/CharacterPlacementScene";
import type { ArSceneBridge } from "./types";

type ParticipantPlacementArViewProps = {
  bridge: ArSceneBridge;
};

export function ParticipantPlacementArView({ bridge }: ParticipantPlacementArViewProps) {
  return (
    <ViroARSceneNavigator
      initialScene={{ scene: CharacterPlacementScene }}
      style={{ flex: 1 }}
      viroAppProps={bridge}
    />
  );
}
