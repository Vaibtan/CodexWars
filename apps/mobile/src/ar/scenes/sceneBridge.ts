import { ViroTrackingStateConstants } from "@reactvision/react-viro";
import type { ArSceneBridge } from "../types";
import type { ArTrackingState } from "../types";

type SceneNavigatorWithAppProps = {
  viroAppProps?: ArSceneBridge;
};

export type ArSceneProps = {
  sceneNavigator?: SceneNavigatorWithAppProps;
};

export function getSceneBridge(props: ArSceneProps): ArSceneBridge | undefined {
  return props.sceneNavigator?.viroAppProps;
}

export function mapViroTrackingState(state: number): ArTrackingState {
  if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
    return "normal";
  }
  if (state === ViroTrackingStateConstants.TRACKING_LIMITED) {
    return "limited";
  }
  return "unavailable";
}
