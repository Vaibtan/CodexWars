import { ViroARSceneNavigator } from "@reactvision/react-viro";
import type { CharacterSelection } from "../features/characters/types";
import { CharacterPlacementScene } from "./scenes/CharacterPlacementScene";
import type { ArSceneBridge } from "./types";

type ParticipantPlacementArViewProps = {
  bridge: ArSceneBridge;
  selection: CharacterSelection;
};

export function ParticipantPlacementArView({
  bridge,
  selection,
}: ParticipantPlacementArViewProps) {
  return (
    <ViroARSceneNavigator
      initialScene={{ scene: CharacterPlacementScene }}
      key={`${selection.characterId}-${selection.colorId}`}
      style={{ flex: 1 }}
      viroAppProps={bridge}
    />
  );
}
