import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  WEAPONS,
  resolveBoltAttack,
  type CharacterSelection,
  type PublicRoomState,
  type WeaponId,
} from "@codexwars/shared";
import { AttackButton } from "../ar/AttackButton";
import { freshAimDirection, type MarkerSpacePose } from "../ar/coordinates";
import { markerTrackingDecision } from "../ar/markerTrackingPolicy";
import type { ArMarkerTrackingState, ArTrackingState } from "../ar/types";
import { BattleStatsPanel } from "../components/BattleStatsPanel";
import { colors } from "../components/theme";
import { getCharacter } from "../features/characters/characterCatalog";
import type { WarRoomRealtimeClient } from "../features/warRoom/realtimeClient";
import { useServerClock } from "../features/warRoom/serverClock";

type ParticipantBattleScreenProps = {
  aimPose: MarkerSpacePose | null;
  onBattleComplete: () => void;
  client: WarRoomRealtimeClient;
  markerTracking: ArMarkerTrackingState;
  room: PublicRoomState;
  selection: CharacterSelection;
  tracking: ArTrackingState;
};

export function ParticipantBattleScreen({ aimPose, client, markerTracking, onBattleComplete, room, selection, tracking }: ParticipantBattleScreenProps) {
  const [lastAction, setLastAction] = useState("Aim at an opponent");
  const clock = useServerClock(room.serverNow, 100);
  const player = client.session.playerId === null ? undefined : room.players[client.session.playerId];
  const aimDirection = freshAimDirection(aimPose, clock.localNow);
  const combatants = Object.values(room.players).map((candidate) => ({
    combatIncluded: candidate.combatIncluded,
    connected: candidate.connected,
    correctAnswers: candidate.correctAnswers,
    displayName: candidate.displayName,
    eliminated: candidate.eliminated,
    hp: candidate.hp,
    playerId: candidate.playerId,
    position: candidate.positionLocked ? { x: candidate.positionX, z: candidate.positionZ } : undefined,
    shield: candidate.shield,
  }));
  const attacker = combatants.find((candidate) => candidate.playerId === client.session.playerId);
  const predictedTargetId = attacker && aimDirection
    ? resolveBoltAttack(
      attacker,
      combatants.filter((candidate) => candidate.playerId !== attacker.playerId),
      aimDirection,
    ).target?.playerId
    : undefined;
  const target = predictedTargetId ? room.players[predictedTargetId] : undefined;

  useEffect(() => {
    if (room.phase === "results") onBattleComplete();
  }, [onBattleComplete, room.phase]);

  const useAttack = async (weaponId: WeaponId) => {
    const freshDirection = freshAimDirection(aimPose, Date.now());
    if (weaponId !== "bolt" || !player || !freshDirection) {
      setLastAction(aimPose?.direction === null ? "Hold the phone level to aim" : "Re-scan the marker before firing");
      return;
    }
    if (!player.positionLocked) {
      setLastAction("Your locked battle position is not available.");
      return;
    }
    setLastAction("Bolt sent…");
    try {
      await client.send("attack", {
        dirX: freshDirection.x,
        dirZ: freshDirection.z,
        ...(predictedTargetId === undefined ? {} : { predictedTargetId }),
        weaponId: "bolt",
      });
      setLastAction(target ? `Bolt fired toward ${target.displayName}.` : "Bolt fired.");
    } catch (error) {
      setLastAction(error instanceof Error ? error.message : String(error));
    }
  };

  const trackingLabel = markerTrackingDecision("battle", markerTracking, tracking).label;
  const boltReady = Boolean(
    player
    && !player.eliminated
    && player.localization !== "lost"
    && tracking !== "unavailable"
    && aimDirection
    && clock.serverNow >= player.nextAttackAt
    && room.phase === "battle",
  );
  const secondsRemaining = Math.max(0, Math.ceil((room.battle.endsAt - clock.serverNow) / 1_000));
  const boltDetail = boltReady ? `${WEAPONS.bolt.damage} damage` : `${(Math.max(0, (player?.nextAttackAt ?? clock.serverNow) - clock.serverNow) / 1_000).toFixed(1)}s cooldown`;

  return (
      <SafeAreaView edges={["top", "bottom"]} pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topBar}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, tracking === "normal" && styles.statusDotReady]} />
            <Text numberOfLines={1} style={styles.statusText}>{trackingLabel}</Text>
          </View>
          <View style={styles.timerPill}><Text style={styles.timerText}>00:{String(secondsRemaining).padStart(2, "0")}</Text></View>
        </View>

        <View pointerEvents="none" style={styles.crosshair}>
          <View style={styles.crosshairHorizontal} />
          <View style={styles.crosshairVertical} />
          <View style={styles.crosshairCenter} />
        </View>

        <View style={styles.hud}>
          <View style={styles.targetRow}>
            <View style={styles.targetCopy}>
              <Text style={styles.targetName}>{target?.displayName.toUpperCase() ?? "NO TARGET"}</Text>
              <Text style={styles.targetStats}>{target ? `${target.hp} HP · ${target.shield} shield` : "Waiting for opponent"}</Text>
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.action}>{lastAction}</Text>
          </View>
          {player ? <BattleStatsPanel label={`You · ${getCharacter(selection.characterId).displayName}`} player={player} /> : null}
          <Text style={styles.safety}>Feet planted · rotate in place to aim</Text>
          <View style={styles.attackRow}>
            <AttackButton accent={colors.accent} detail={boltDetail} disabled={!boltReady} id="bolt" label="Bolt" onPress={useAttack} />
          </View>
        </View>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  topBar: { alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingTop: 8 },
  statusPill: { alignItems: "center", backgroundColor: colors.cameraScrim, borderRadius: 999, flex: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 13 },
  statusDot: { backgroundColor: colors.accent, borderRadius: 5, height: 10, width: 10 },
  statusDotReady: { backgroundColor: colors.success },
  statusText: { color: colors.inkMuted, flex: 1, fontSize: 12, fontWeight: "700" },
  timerPill: { alignItems: "center", backgroundColor: colors.cameraScrim, borderRadius: 999, justifyContent: "center", minHeight: 46, minWidth: 62 },
  timerText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  crosshair: { alignSelf: "center", height: 54, position: "absolute", top: "43%", width: 54 },
  crosshairHorizontal: { backgroundColor: colors.ink, height: 2, left: 0, position: "absolute", right: 0, top: 26 },
  crosshairVertical: { backgroundColor: colors.ink, bottom: 0, left: 26, position: "absolute", top: 0, width: 2 },
  crosshairCenter: { alignSelf: "center", backgroundColor: colors.accent, borderRadius: 5, height: 10, marginTop: 22, width: 10 },
  hud: { backgroundColor: colors.cameraScrim, paddingBottom: 10, paddingHorizontal: 14, paddingTop: 14 },
  targetRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  targetCopy: { flexShrink: 0 },
  targetName: { color: colors.ink, fontSize: 13, fontWeight: "900", letterSpacing: 0.6 },
  targetStats: { color: colors.inkSubtle, fontSize: 11, fontWeight: "700", marginTop: 2 },
  action: { color: colors.inkMuted, flex: 1, fontSize: 11, marginLeft: 12, textAlign: "right" },
  safety: { color: colors.accent, fontSize: 12, fontWeight: "800", marginTop: 10, textAlign: "center" },
  attackRow: { flexDirection: "row", gap: 9, marginTop: 11 },
});
