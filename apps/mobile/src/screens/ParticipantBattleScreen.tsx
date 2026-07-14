import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { AttackButton } from "../ar/AttackButton";
import { BattleScene } from "../ar/scenes/BattleScene";
import type { ArSceneBridge, ArTrackingState, AttackId } from "../ar/types";
import { colors } from "../components/theme";
import { getCharacter } from "../features/characters/characterCatalog";
import type { CharacterSelection } from "../features/characters/types";

type ParticipantBattleScreenProps = {
  onBattleComplete: () => void;
  selection: CharacterSelection;
};

export function ParticipantBattleScreen({ onBattleComplete, selection }: ParticipantBattleScreenProps) {
  const [tracking, setTracking] = useState<ArTrackingState>("initializing");
  const [lastAction, setLastAction] = useState("Aim at an opponent");
  const [fireballCharges, setFireballCharges] = useState(2);
  const [shieldCharges, setShieldCharges] = useState(1);
  const bridge = useMemo<ArSceneBridge>(() => ({ onTrackingChanged: setTracking }), []);

  const useAttack = (attack: AttackId) => {
    if (attack === "fireball") {
      if (!fireballCharges) return setLastAction("No fireballs remaining");
      setFireballCharges((value) => value - 1);
      return setLastAction("Fireball launched · demo only");
    }
    if (attack === "shield") {
      if (!shieldCharges) return setLastAction("Shield already used");
      setShieldCharges((value) => value - 1);
      return setLastAction("Shield raised · demo only");
    }
    setLastAction("Basic bolt fired · demo only");
  };

  const trackingLabel = tracking === "normal" ? "Tracking stable" : tracking === "limited" ? "Move slowly · tracking limited" : "Starting camera…";

  return (
    <View style={styles.screen}>
      <ViroARSceneNavigator initialScene={{ scene: BattleScene }} style={styles.arView} viroAppProps={bridge} />
      <SafeAreaView edges={["top", "bottom"]} pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topBar}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, tracking === "normal" && styles.statusDotReady]} />
            <Text numberOfLines={1} style={styles.statusText}>{trackingLabel}</Text>
          </View>
          <View style={styles.timerPill}><Text style={styles.timerText}>00:60</Text></View>
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
          <View style={styles.playerRow}>
            <View>
              <Text style={styles.playerLabel}>YOU · {getCharacter(selection.characterId).displayName.toUpperCase()}</Text>
              <Text style={styles.healthValue}>100 HP · 20 shield</Text>
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.action}>{lastAction}</Text>
          </View>
          <View style={styles.healthTrack}><View style={styles.healthFill} /></View>
          <Text style={styles.safety}>Feet planted · rotate in place to aim</Text>
          <View style={styles.attackRow}>
            <AttackButton accent={colors.accent} detail="Unlimited" id="bolt" label="Bolt" onPress={useAttack} />
            <AttackButton accent={colors.fire} detail={`${fireballCharges} charges`} id="fireball" label="Fireball" onPress={useAttack} />
            <AttackButton accent={colors.success} detail={`${shieldCharges} charge`} id="shield" label="Shield" onPress={useAttack} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  arView: { flex: 1 },
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
  playerRow: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" },
  playerLabel: { color: colors.inkSubtle, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  healthValue: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: 3 },
  action: { color: colors.inkMuted, flex: 1, fontSize: 11, marginLeft: 12, textAlign: "right" },
  healthTrack: { backgroundColor: colors.surfaceStrong, borderRadius: 4, height: 7, marginTop: 9, overflow: "hidden" },
  healthFill: { backgroundColor: colors.success, borderRadius: 4, height: 7, width: "84%" },
  safety: { color: colors.accent, fontSize: 12, fontWeight: "800", marginTop: 10, textAlign: "center" },
  attackRow: { flexDirection: "row", gap: 9, marginTop: 11 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
