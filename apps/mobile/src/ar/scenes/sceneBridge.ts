import type { ArSceneBridge } from "../types";

type SceneNavigatorWithAppProps = {
  viroAppProps?: ArSceneBridge;
};

export type ArSceneProps = {
  sceneNavigator?: SceneNavigatorWithAppProps;
};

export function getSceneBridge(props: ArSceneProps): ArSceneBridge | undefined {
  return props.sceneNavigator?.viroAppProps;
}
