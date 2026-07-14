import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { BattleScene } from "./scenes/BattleScene";
import type { ArSceneBridge } from "./types";

type ParticipantBattleArViewProps = {
  bridge: ArSceneBridge;
};

export function ParticipantBattleArView({ bridge }: ParticipantBattleArViewProps) {
  return (
    <ViroARSceneNavigator
      initialScene={{ scene: BattleScene }}
      style={{ flex: 1 }}
      viroAppProps={bridge}
    />
  );
}
