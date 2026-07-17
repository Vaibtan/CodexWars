import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PublicRoomState } from "@codexwars/shared";
import { ParticipantArenaArView } from "../ar/ParticipantArenaArView";
import type { MarkerSpacePose } from "../ar/coordinates";
import { markerTrackingDecision } from "../ar/markerTrackingPolicy";
import type { ArSceneBridge, ArMarkerTrackingState, ArTrackingState } from "../ar/types";
import type { CharacterSelection } from "@codexwars/shared";
import type { WarRoomRealtimeClient } from "../features/warRoom/realtimeClient";
import { ParticipantBattleScreen } from "./ParticipantBattleScreen";
import { ParticipantPlacementScreen } from "./ParticipantPlacementScreen";

type ParticipantArenaScreenProps = {
  client: WarRoomRealtimeClient;
  mode: "battle" | "positioning";
  onBack: () => void;
  onBattleComplete: () => void;
  onReturnHome: () => void;
  onStartBattle: () => void;
  room: PublicRoomState;
  selection: CharacterSelection;
};

export function ParticipantArenaScreen({
  client,
  mode,
  onBack,
  onBattleComplete,
  onReturnHome,
  onStartBattle,
  room,
  selection,
}: ParticipantArenaScreenProps) {
  const [tracking, setTracking] = useState<ArTrackingState>("initializing");
  const [markerTracking, setMarkerTracking] = useState<ArMarkerTrackingState>("searching");
  const [pose, setPose] = useState<MarkerSpacePose | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const battleMarkerDecision = markerTrackingDecision("battle", markerTracking, tracking);
  const player = client.session.playerId === null ? undefined : room.players[client.session.playerId];
  const position = player?.positionLocked
    ? { x: player.positionX, z: player.positionZ }
    : pose === null
      ? null
      : { x: Number(pose.position.x.toFixed(2)), z: Number(pose.position.z.toFixed(2)) };
  const battleActors = useMemo(() => Object.values(room.players)
    .filter((candidate) => candidate.playerId !== client.session.playerId && candidate.combatIncluded && candidate.positionLocked)
    .map((candidate) => ({
      characterSelection: { characterId: candidate.characterId, colorId: candidate.characterColorId },
      displayName: candidate.displayName,
      eliminated: candidate.eliminated,
      hp: candidate.hp,
      maxHp: candidate.maxHp,
      playerId: candidate.playerId,
      position: { x: candidate.positionX, z: candidate.positionZ },
    })), [client.session.playerId, room.players]);

  const bridge = useMemo<ArSceneBridge>(() => ({
    arenaRadiusM: room.arena.radiusM,
    battleActors,
    characterSelection: selection,
    localPreviewPosition: position ?? undefined,
    onMarkerTrackingChanged: (state) => {
      setMarkerTracking(state);
      if (state === "lost") setPose(null);
    },
    onPoseChanged: setPose,
    onTrackingChanged: setTracking,
    phase: mode,
  }), [battleActors, mode, position, room.arena.radiusM, selection]);

  useEffect(() => {
    if (!player || mode !== "battle") return;
    const localization = battleMarkerDecision.localization;
    if (player.localization === localization) return;
    setSyncError(null);
    void client.send("localization_changed", { state: localization }).catch((error: unknown) => {
      setSyncError(error instanceof Error ? error.message : String(error));
    });
  }, [battleMarkerDecision.localization, client, mode, player]);

  return (
    <View style={styles.screen}>
      <ParticipantArenaArView bridge={bridge} />
      {mode === "battle" ? (
        <ParticipantBattleScreen
          aimPose={pose}
          client={client}
          markerTracking={markerTracking}
          onBattleComplete={onBattleComplete}
          room={room}
          selection={selection}
          tracking={tracking}
        />
      ) : (
        <ParticipantPlacementScreen
          client={client}
          markerTracking={markerTracking}
          onBack={onBack}
          onReturnHome={onReturnHome}
          onStartBattle={onStartBattle}
          position={position}
          room={room}
          selection={selection}
          tracking={tracking}
        />
      )}
      {syncError ? <Text accessibilityLiveRegion="assertive" style={styles.syncError}>{syncError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#050711", flex: 1 },
  syncError: { backgroundColor: "rgba(15, 8, 20, 0.9)", bottom: 20, color: "#FF6B7A", left: 16, padding: 10, position: "absolute", right: 16, textAlign: "center" },
});
