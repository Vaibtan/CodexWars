import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { colors } from "../components/theme";
import { AttackButton } from "./AttackButton";
import { BattleScene } from "./scenes/BattleScene";
import { FloorScanScene } from "./scenes/FloorScanScene";
import type { ArFlowPhase, ArSceneBridge, ArTrackingState, AttackId } from "./types";

type ArDemoScreenProps = {
  onExit: () => void;
};

const trackingCopy: Record<ArTrackingState, string> = {
  initializing: "Starting camera…",
  limited: "Move slowly and aim at a textured floor",
  normal: "Tracking stable",
  unavailable: "Tracking unavailable",
};

export function ArDemoScreen({ onExit }: ArDemoScreenProps) {
  const navigatorRef = useRef<InstanceType<typeof ViroARSceneNavigator> | null>(null);
  const [phase, setPhase] = useState<ArFlowPhase>("floor-scan");
  const [floorFound, setFloorFound] = useState(false);
  const [trackingState, setTrackingState] = useState<ArTrackingState>("initializing");
  const [lastAction, setLastAction] = useState("Aim at an opponent");
  const [fireballCharges, setFireballCharges] = useState(2);
  const [shieldCharges, setShieldCharges] = useState(1);

  const sceneBridge = useMemo<ArSceneBridge>(
    () => ({
      onFloorFound: () => setFloorFound(true),
      onTrackingChanged: setTrackingState,
    }),
    [],
  );

  const enterBattle = () => {
    if (!floorFound) {
      return;
    }
    setPhase("battle");
    navigatorRef.current?.arSceneNavigator?.replace({ scene: BattleScene });
  };

  const useAttack = (attack: AttackId) => {
    if (attack === "fireball") {
      if (fireballCharges === 0) {
        setLastAction("No fireball charges remaining");
        return;
      }
      setFireballCharges((charges) => charges - 1);
      setLastAction("Fireball launched · demo only");
      return;
    }
    if (attack === "shield") {
      if (shieldCharges === 0) {
        setLastAction("Shield already used");
        return;
      }
      setShieldCharges((charges) => charges - 1);
      setLastAction("Shield raised · demo only");
      return;
    }
    setLastAction("Basic bolt fired · demo only");
  };

  return (
    <View style={styles.screen}>
      <ViroARSceneNavigator
        initialScene={{ scene: FloorScanScene }}
        ref={(navigator) => {
          navigatorRef.current = navigator;
        }}
        style={styles.arView}
        viroAppProps={sceneBridge}
      />

      <SafeAreaView edges={["top", "bottom"]} pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" style={styles.topBar}>
          <Pressable
            accessibilityLabel="Exit AR demo"
            accessibilityRole="button"
            onPress={onExit}
            style={({ pressed }) => [styles.backButton, pressed && styles.controlPressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: trackingState === "normal" ? colors.success : colors.accent },
              ]}
            />
            <Text numberOfLines={1} style={styles.statusText}>
              {trackingCopy[trackingState]}
            </Text>
          </View>
          <View style={styles.phasePill}>
            <Text style={styles.phaseText}>{phase === "battle" ? "00:60" : "HOST"}</Text>
          </View>
        </View>

        {phase === "floor-scan" ? (
          <View style={styles.scanContent}>
            <View pointerEvents="none" style={styles.scanGuide}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <View style={styles.bottomPanel}>
              <Text style={styles.panelKicker}>Organizer setup</Text>
              <Text style={styles.panelTitle}>
                {floorFound ? "Arena floor found" : "Scan the floor"}
              </Text>
              <Text style={styles.panelBody}>
                {floorFound
                  ? "A demo floor plane is locked. The production flow will use the printed arena marker as the shared origin."
                  : "Point down and move the phone in a slow arc. Keep textured floor details inside the frame."}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={!floorFound}
                onPress={enterBattle}
                style={({ pressed }) => [
                  styles.continueButton,
                  !floorFound && styles.continueButtonDisabled,
                  pressed && floorFound && styles.controlPressed,
                ]}
              >
                <Text style={styles.continueButtonText}>
                  {floorFound ? "Use floor and enter battle" : "Looking for floor…"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View pointerEvents="box-none" style={styles.battleContent}>
            <View pointerEvents="none" style={styles.crosshair}>
              <View style={styles.crosshairHorizontal} />
              <View style={styles.crosshairVertical} />
              <View style={styles.crosshairCenter} />
            </View>

            <View style={styles.battleHud}>
              <View style={styles.playerRow}>
                <View style={styles.healthCopy}>
                  <Text style={styles.healthLabel}>YOU</Text>
                  <Text style={styles.healthValue}>100 HP · 20 shield</Text>
                </View>
                <Text accessibilityLiveRegion="polite" style={styles.actionState}>
                  {lastAction}
                </Text>
              </View>
              <View style={styles.healthTrack}>
                <View style={styles.healthFill} />
              </View>
              <View style={styles.attackRow}>
                <AttackButton
                  accent={colors.accent}
                  detail="Unlimited"
                  id="bolt"
                  label="Bolt"
                  onPress={useAttack}
                />
                <AttackButton
                  accent={colors.fire}
                  detail={`${fireballCharges} charges`}
                  id="fireball"
                  label="Fireball"
                  onPress={useAttack}
                />
                <AttackButton
                  accent={colors.success}
                  detail={`${shieldCharges} charge`}
                  id="shield"
                  label="Shield"
                  onPress={useAttack}
                />
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  arView: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.cameraScrim,
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  backButtonText: { color: colors.ink, fontSize: 34, lineHeight: 36, marginTop: -3 },
  statusPill: {
    alignItems: "center",
    backgroundColor: colors.cameraScrim,
    borderRadius: 999,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 13,
  },
  statusDot: { borderRadius: 5, height: 10, width: 10 },
  statusText: { color: colors.inkMuted, flex: 1, fontSize: 12, fontWeight: "700" },
  phasePill: {
    alignItems: "center",
    backgroundColor: colors.cameraScrim,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 58,
    paddingHorizontal: 12,
  },
  phaseText: { color: colors.ink, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  controlPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  scanContent: { flex: 1, justifyContent: "space-between", padding: 18 },
  scanGuide: { alignSelf: "center", height: 210, marginTop: 76, width: "82%" },
  corner: { borderColor: colors.accent, height: 38, position: "absolute", width: 38 },
  cornerTopLeft: { borderLeftWidth: 3, borderTopWidth: 3, left: 0, top: 0 },
  cornerTopRight: { borderRightWidth: 3, borderTopWidth: 3, right: 0, top: 0 },
  cornerBottomLeft: { borderBottomWidth: 3, borderLeftWidth: 3, bottom: 0, left: 0 },
  cornerBottomRight: { borderBottomWidth: 3, borderRightWidth: 3, bottom: 0, right: 0 },
  bottomPanel: { backgroundColor: colors.cameraScrim, borderRadius: 16, padding: 18 },
  panelKicker: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  panelTitle: { color: colors.ink, fontSize: 25, fontWeight: "800", marginTop: 7 },
  panelBody: { color: colors.inkMuted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  continueButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    justifyContent: "center",
    marginTop: 17,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  continueButtonDisabled: { backgroundColor: colors.surfaceStrong },
  continueButtonText: { color: colors.accentInk, fontSize: 16, fontWeight: "800" },
  battleContent: { flex: 1, justifyContent: "flex-end" },
  crosshair: { alignSelf: "center", height: 54, position: "absolute", top: "43%", width: 54 },
  crosshairHorizontal: { backgroundColor: colors.ink, height: 2, left: 0, position: "absolute", right: 0, top: 26 },
  crosshairVertical: { backgroundColor: colors.ink, bottom: 0, left: 26, position: "absolute", top: 0, width: 2 },
  crosshairCenter: { alignSelf: "center", backgroundColor: colors.accent, borderRadius: 5, height: 10, marginTop: 22, width: 10 },
  battleHud: { backgroundColor: colors.cameraScrim, paddingBottom: 10, paddingHorizontal: 14, paddingTop: 14 },
  playerRow: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" },
  healthCopy: { flexShrink: 0 },
  healthLabel: { color: colors.inkSubtle, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  healthValue: { color: colors.ink, fontSize: 15, fontWeight: "800", marginTop: 2 },
  actionState: { color: colors.inkMuted, flex: 1, fontSize: 11, marginLeft: 12, textAlign: "right" },
  healthTrack: { backgroundColor: colors.surfaceStrong, borderRadius: 4, height: 7, marginTop: 9, overflow: "hidden" },
  healthFill: { backgroundColor: colors.success, borderRadius: 4, height: 7, width: "84%" },
  attackRow: { flexDirection: "row", gap: 9, marginTop: 13 },
});
