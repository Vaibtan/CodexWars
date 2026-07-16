import { useRef } from "react";
import {
  Viro3DObject,
  ViroAmbientLight,
  ViroARImageMarker,
  ViroARScene,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroQuad,
  ViroSphere,
  ViroText,
  type ViroAnchor,
  type ViroCameraTransform,
} from "@reactvision/react-viro";
import { getCharacter, getCharacterSource } from "../../features/characters/characterCatalog";
import { ARENA_MARKER_TARGET } from "../arenaMarker";
import { captureMarkerSpacePose, type MarkerAnchorPose } from "../coordinates";
import type { ArMarkerTrackingState } from "../types";
import { getSceneBridge, mapViroTrackingState, type ArSceneProps } from "./sceneBridge";

const POSE_PUBLISH_INTERVAL_MS = 100;

ViroMaterials.createMaterials({
  arenaBoundary: { diffuseColor: "#5DE2D7", lightingModel: "Constant" },
  arenaOrigin: { diffuseColor: "#FFCC4D", lightingModel: "Constant" },
  sharedHealth: { diffuseColor: "#6CE5A8", lightingModel: "Constant" },
  sharedHealthEmpty: { diffuseColor: "#3C3A45", lightingModel: "Constant" },
});

function markerState(anchor: ViroAnchor): ArMarkerTrackingState {
  const method = anchor.trackingMethod?.toLowerCase() ?? "";
  if (method.includes("not") || method.includes("stopped")) return "lost";
  if (method.includes("last") || method.includes("limited")) return "degraded";
  return "tracked";
}

function anchorPose(anchor: ViroAnchor): MarkerAnchorPose {
  return {
    position: [...anchor.position],
    rotation: [...anchor.rotation],
  };
}

export function SharedArenaScene(props: ArSceneProps = {}) {
  const bridge = getSceneBridge(props);
  const markerPose = useRef<MarkerAnchorPose | null>(null);
  const currentMarkerState = useRef<ArMarkerTrackingState>("searching");
  const lastPosePublishAt = useRef(0);

  const publishMarkerState = (state: ArMarkerTrackingState) => {
    if (currentMarkerState.current === state) return;
    currentMarkerState.current = state;
    bridge?.onMarkerTrackingChanged?.(state);
  };

  const updateMarker = (anchor: ViroAnchor) => {
    markerPose.current = anchorPose(anchor);
    publishMarkerState(markerState(anchor));
  };

  const removeMarker = () => {
    markerPose.current = null;
    publishMarkerState("lost");
  };

  const updateCamera = (camera: ViroCameraTransform) => {
    const marker = markerPose.current;
    const state = currentMarkerState.current;
    const capturedAt = Date.now();
    if (
      marker === null
      || state === "lost"
      || state === "searching"
      || capturedAt - lastPosePublishAt.current < POSE_PUBLISH_INTERVAL_MS
    ) {
      return;
    }
    lastPosePublishAt.current = capturedAt;
    bridge?.onPoseChanged?.(captureMarkerSpacePose(marker, camera, capturedAt));
  };

  const radiusM = bridge?.arenaRadiusM ?? 3;
  const preview = bridge?.localPreviewPosition;
  const selection = bridge?.characterSelection;
  const previewCharacter = selection ? getCharacter(selection.characterId) : null;
  const actors = bridge?.battleActors ?? [];

  return (
    <ViroARScene
      anchorDetectionTypes={[]}
      onCameraTransformUpdate={updateCamera}
      onTrackingUpdated={(state) => {
        const mapped = mapViroTrackingState(state);
        bridge?.onTrackingChanged(mapped);
        if (mapped === "unavailable") removeMarker();
      }}
    >
      <ViroAmbientLight color="#FFFFFF" intensity={220} />
      <ViroARImageMarker
        onAnchorFound={updateMarker}
        onAnchorRemoved={removeMarker}
        onAnchorUpdated={updateMarker}
        target={ARENA_MARKER_TARGET}
      >
        <ViroSphere
          materials={["arenaBoundary"]}
          opacity={0.08}
          position={[0, 0.005, 0]}
          radius={radiusM}
          scale={[1, 0.002, 1]}
          widthSegmentCount={48}
        />
        <ViroSphere
          materials={["arenaOrigin"]}
          opacity={0.82}
          position={[0, 0.012, 0]}
          radius={0.12}
          scale={[1, 0.025, 1]}
          widthSegmentCount={24}
        />
        <ViroQuad
          height={0.18}
          materials={["arenaOrigin"]}
          opacity={0.72}
          position={[0, 0.014, -0.24]}
          rotation={[-90, 0, 0]}
          width={0.035}
        />

        {bridge?.phase === "positioning" && preview && selection && previewCharacter ? (
          <ViroNode position={[preview.x, 0.02, preview.z]}>
            <ViroSphere
              materials={["arenaOrigin"]}
              opacity={0.65}
              radius={0.44}
              scale={[1, 0.025, 1]}
              widthSegmentCount={24}
            />
            <Viro3DObject
              opacity={0.78}
              position={[0, 0.02, 0]}
              scale={[...previewCharacter.scale]}
              source={getCharacterSource(selection.characterId, selection.colorId)}
              type="GLB"
            />
            <ViroText
              position={[0, 1.6, 0]}
              style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "700", textAlign: "center" }}
              text="YOUR LOCKED SPOT"
              transformBehaviors={["billboardY"]}
              width={1.8}
            />
          </ViroNode>
        ) : null}

        {bridge?.phase === "battle" ? actors.map((actor) => {
          const character = getCharacter(actor.characterSelection.characterId);
          const healthWidth = 0.72 * Math.max(0, Math.min(1, actor.hp / actor.maxHp));
          return (
            <ViroNode
              key={actor.playerId}
              opacity={actor.eliminated ? 0.28 : 1}
              position={[actor.position.x, 0.02, actor.position.z]}
            >
              <ViroText
                position={[0, 1.55, 0]}
                style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "700", textAlign: "center" }}
                text={actor.eliminated ? `${actor.displayName} · OUT` : actor.displayName}
                transformBehaviors={["billboardY"]}
                width={1.6}
              />
              <ViroBox height={0.055} length={0.04} materials={["sharedHealthEmpty"]} position={[0, 1.34, 0]} width={0.72} />
              {healthWidth > 0 ? (
                <ViroBox
                  height={0.06}
                  length={0.045}
                  materials={["sharedHealth"]}
                  position={[(healthWidth - 0.72) / 2, 1.34, -0.01]}
                  width={healthWidth}
                />
              ) : null}
              <Viro3DObject
                position={[0, 0.02, 0]}
                scale={[...character.scale]}
                source={getCharacterSource(actor.characterSelection.characterId, actor.characterSelection.colorId)}
                type="GLB"
              />
            </ViroNode>
          );
        }) : null}
      </ViroARImageMarker>
    </ViroARScene>
  );
}
