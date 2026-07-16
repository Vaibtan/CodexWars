import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { SharedArenaScene } from "./scenes/SharedArenaScene";
import type { ArSceneBridge } from "./types";

export function ParticipantArenaArView({ bridge }: { bridge: ArSceneBridge }) {
  return (
    <ViroARSceneNavigator
      initialScene={{ scene: SharedArenaScene }}
      provider="none"
      style={{ flex: 1 }}
      viroAppProps={bridge}
    />
  );
}
