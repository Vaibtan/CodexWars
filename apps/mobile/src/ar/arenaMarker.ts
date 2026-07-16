import { ViroARTrackingTargets } from "@reactvision/react-viro";

export const ARENA_MARKER_TARGET = "codexwars_arena_marker_v1";
export const ARENA_MARKER_PHYSICAL_WIDTH_M = 0.18;

ViroARTrackingTargets.createTargets({
  [ARENA_MARKER_TARGET]: {
    orientation: "Up",
    physicalWidth: ARENA_MARKER_PHYSICAL_WIDTH_M,
    source: require("../../assets/arena-marker.png"),
    type: "Image",
  },
});
