import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  deriveBattleLoadout,
  getWeaponReadiness,
  type WarRoomState,
  type WeaponId,
} from "@codexwars/shared";
import { AttackButton } from "../ar/AttackButton";
import { ParticipantBattleArView } from "../ar/ParticipantBattleArView";
import type { ArSceneBridge, ArTrackingState } from "../ar/types";
import { BattleStatsPanel } from "../components/BattleStatsPanel";
import { colors } from "../components/theme";
import { getCharacter } from "../features/characters/characterCatalog";
import type { CharacterSelection } from "../features/characters/types";
import type { WarRoomSession } from "../features/warRoom/types";
import { attackParticipant } from "../lib/firebase/warRooms";

type ParticipantBattleScreenProps = {
  onBattleComplete: () => void;
  correctAnswers: number;
  room: WarRoomState;
  selection: CharacterSelection;
  session: WarRoomSession;
};

const rejectionCopy = {
  ATTACKER_ELIMINATED: "You are eliminated",
  COOLDOWN_ACTIVE: "Ability is cooling down",
  INVALID_TIME: "Battle clock unavailable",
  NO_CHARGES: "No charges remaining",
  TARGET_ELIMINATED: "Mira is already eliminated",
  WEAPON_LOCKED: "Earn this ability in the quiz first",
} as const;

export function ParticipantBattleScreen({ correctAnswers, onBattleComplete, room, selection, session }: ParticipantBattleScreenProps) {
  const [tracking, setTracking] = useState<ArTrackingState>("initializing");
  const [lastAction, setLastAction] = useState("Aim at an opponent");
  const [clockMs, setClockMs] = useState(Date.now());
  const bridge = useMemo<ArSceneBridge>(() => ({ onTrackingChanged: setTracking }), []);
  const battleStats = room.stats[session.uid] ?? deriveBattleLoadout({ correctAnswers, totalQuestions: 10 });
  const target = Object.values(room.members).find(
    (member) => member.id !== session.uid && member.combatIncluded && !room.stats[member.id]?.eliminated,
  ) ?? null;
  const targetStats = target ? room.stats[target.id] : null;
  const latestEvent = Object.values(room.events).sort((a, b) => b.sequence - a.sequence)[0];

  useEffect(() => {
    const interval = setInterval(() => setClockMs(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (room.phase === "results") onBattleComplete();
  }, [onBattleComplete, room.phase]);

  useEffect(() => {
    if (latestEvent?.message) setLastAction(latestEvent.message);
  }, [latestEvent?.id, latestEvent?.message]);

  const useAttack = async (weaponId: WeaponId) => {
    if (!target) {
      setLastAction("No active target");
      return;
    }
    setLastAction(`${weaponId === "bolt" ? "Bolt" : "Fireball"} sent…`);
    try {
      const origin = room.members[session.uid]?.position;
      if (!origin || !target.position) throw new Error("Battle positions are not available.");
      await attackParticipant(session, room, {
        dirX: target.position.x - origin.x,
        dirZ: target.position.z - origin.z,
        predictedTargetId: target.id,
      }, weaponId);
    } catch (error) {
      setLastAction(error instanceof Error ? error.message : String(error));
    }
  };

  const trackingLabel = tracking === "normal" ? "Tracking stable" : tracking === "limited" ? "Move slowly · tracking limited" : "Starting camera…";
  const boltReadiness = getWeaponReadiness(battleStats, "bolt", clockMs);
  const fireballReadiness = getWeaponReadiness(battleStats, "fireball", clockMs);
  const secondsRemaining = Math.max(0, Math.ceil(((room.battleEndsAt ?? clockMs) - clockMs) / 1_000));
  const readinessDetail = (weaponId: WeaponId) => {
    const readiness = weaponId === "bolt" ? boltReadiness : fireballReadiness;
    if (readiness.ready) {
      const charges = battleStats.weapons[weaponId].charges;
      return charges === null ? `${battleStats.weapons[weaponId].damage} damage` : `${charges} charge${charges === 1 ? "" : "s"}`;
    }
    if (readiness.code === "COOLDOWN_ACTIVE") {
      return `${((readiness.remainingCooldownMs ?? 0) / 1_000).toFixed(1)}s cooldown`;
    }
    return readiness.code === "WEAPON_LOCKED" ? "Quiz ability" : "Unavailable";
  };

  return (
    <View style={styles.screen}>
      <ParticipantBattleArView bridge={bridge} />
      <SafeAreaView edges={["top", "bottom"]} pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topBar}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, tracking === "normal" && styles.statusDotReady]} />
            <Text numberOfLines={1} style={styles.statusText}>{trackingLabel}</Text>
          </View>
          <View style={styles.timerPill}><Text style={styles.timerText}>00:{String(secondsRemaining).padStart(2, "0")}</Text></View>
          <Pressable accessibilityRole="button" onPress={onBattleComplete} style={({ pressed }) => [styles.demoEnd, pressed && styles.pressed]}>
            <Text style={styles.demoEndText}>Finish demo</Text>
          </Pressable>
        </View>

        <View pointerEvents="none" style={styles.crosshair}>
          <View style={styles.crosshairHorizontal} />
          <View style={styles.crosshairVertical} />
          <View style={styles.crosshairCenter} />
        </View>

        <View style={styles.hud}>
          <View style={styles.targetRow}>
            <View style={styles.targetCopy}>
              <Text style={styles.targetName}>{target?.nickname.toUpperCase() ?? "NO TARGET"}</Text>
              <Text style={styles.targetStats}>{targetStats ? `${targetStats.hp} HP · ${targetStats.shield} shield` : "Waiting for opponent"}</Text>
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.action}>{lastAction}</Text>
          </View>
          <BattleStatsPanel battleStats={battleStats} label={`You · ${getCharacter(selection.characterId).displayName}`} />
          <Text style={styles.safety}>Feet planted · rotate in place to aim</Text>
          <View style={styles.attackRow}>
            <AttackButton accent={colors.accent} detail={readinessDetail("bolt")} disabled={!boltReadiness.ready || !target} id="bolt" label="Bolt" onPress={useAttack} />
            <AttackButton accent={colors.fire} detail={readinessDetail("fireball")} disabled={!fireballReadiness.ready || !target} id="fireball" label="Fireball" onPress={useAttack} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  topBar: { alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingTop: 8 },
  statusPill: { alignItems: "center", backgroundColor: colors.cameraScrim, borderRadius: 999, flex: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 13 },
  statusDot: { backgroundColor: colors.accent, borderRadius: 5, height: 10, width: 10 },
  statusDotReady: { backgroundColor: colors.success },
  statusText: { color: colors.inkMuted, flex: 1, fontSize: 12, fontWeight: "700" },
  timerPill: { alignItems: "center", backgroundColor: colors.cameraScrim, borderRadius: 999, justifyContent: "center", minHeight: 46, minWidth: 62 },
  timerText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  demoEnd: { alignItems: "center", backgroundColor: colors.cameraScrim, borderRadius: 12, justifyContent: "center", minHeight: 46, paddingHorizontal: 11 },
  demoEndText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
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
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
