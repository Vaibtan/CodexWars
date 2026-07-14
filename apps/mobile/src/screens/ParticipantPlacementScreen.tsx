import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { CharacterPreview } from "../components/CharacterPreview";
import { colors } from "../components/theme";
import { CharacterPlacementScene } from "../ar/scenes/CharacterPlacementScene";
import type { ArSceneBridge, ArTrackingState } from "../ar/types";
import { getCharacter, getCharacterColor } from "../features/characters/characterCatalog";
import type {
  ArenaPosition,
  CharacterSelection,
  WaitingParticipant,
} from "../features/characters/types";

type ParticipantPlacementScreenProps = {
  onBack: () => void;
  onReady: (participant: WaitingParticipant) => void;
  onReturnHome: () => void;
  selection: CharacterSelection;
};

const trackingCopy: Record<ArTrackingState, string> = {
  initializing: "Starting camera…",
  limited: "Move slowly and keep the floor visible",
  normal: "Floor tracking stable",
  unavailable: "Tracking unavailable",
};

export function ParticipantPlacementScreen({
  onBack,
  onReady,
  onReturnHome,
  selection,
}: ParticipantPlacementScreenProps) {
  const [tracking, setTracking] = useState<ArTrackingState>("initializing");
  const [position, setPosition] = useState<ArenaPosition | null>(null);
  const [waiting, setWaiting] = useState(false);
  const character = getCharacter(selection.characterId);
  const characterColor = getCharacterColor(selection.colorId);

  const sceneBridge = useMemo<ArSceneBridge>(
    () => ({
      characterSelection: selection,
      onPlacementChanged: setPosition,
      onTrackingChanged: setTracking,
    }),
    [selection],
  );

  const joinBattle = () => {
    if (!position || tracking !== "normal") {
      return;
    }
    onReady({
      id: "local-participant",
      nickname: "You",
      position,
      selection,
      status: "waiting",
    });
    setWaiting(true);
  };

  if (waiting) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.waitingScreen}>
        <View style={styles.waitingTop}>
          <View style={styles.readyPill}>
            <View style={styles.readyDot} />
            <Text style={styles.readyPillText}>POSITION LOCKED</Text>
          </View>
          <Text accessibilityRole="header" style={styles.waitingTitle}>You’re in the arena.</Text>
          <Text style={styles.waitingBody}>
            The organizer can now see you as waiting. Keep your feet planted; the battle begins only when they press Start battle.
          </Text>
        </View>

        <View style={styles.waitingCharacterRow}>
          <CharacterPreview characterId={selection.characterId} colorId={selection.colorId} />
          <View style={styles.waitingDetails}>
            <Text style={styles.waitingName}>{character.displayName}</Text>
            <Text style={styles.waitingMeta}>{character.role} · {characterColor.label}</Text>
            <View style={styles.positionReadout}>
              <Text style={styles.positionLabel}>LOCKED COORDINATES</Text>
              <Text style={styles.positionValue}>X {position?.x.toFixed(2)} m  ·  Z {position?.z.toFixed(2)} m</Text>
            </View>
          </View>
        </View>

        <View style={styles.waitingFooter}>
          <Text accessibilityLiveRegion="polite" style={styles.organizerStatus}>Waiting for organizer…</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onReturnHome}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Return to demo home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const canJoin = Boolean(position) && tracking === "normal";

  return (
    <View style={styles.screen}>
      <ViroARSceneNavigator
        initialScene={{ scene: CharacterPlacementScene }}
        style={styles.arView}
        viroAppProps={sceneBridge}
      />
      <SafeAreaView edges={["top", "bottom"]} pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" style={styles.topBar}>
          <Pressable
            accessibilityLabel="Back to character customization"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]}
          >
            <Text style={styles.cameraBack}>‹</Text>
          </Pressable>
          <View style={styles.trackingPill}>
            <View style={[styles.trackingDot, tracking === "normal" && styles.trackingDotReady]} />
            <Text numberOfLines={1} style={styles.trackingText}>{trackingCopy[tracking]}</Text>
          </View>
          <Text style={styles.stepPill}>2 of 2</Text>
        </View>

        <View pointerEvents="box-none" style={styles.placementBody}>
          {!position ? (
            <View pointerEvents="none" style={styles.reticle}>
              <View style={styles.reticleCenter} />
            </View>
          ) : null}
          <View style={styles.placementPanel}>
            <View style={styles.placementHeader}>
              <View style={styles.miniPreview}>
                <CharacterPreview characterId={selection.characterId} colorId={selection.colorId} compact />
              </View>
              <View style={styles.placementCopy}>
                <Text style={styles.placementTitle}>{position ? "Position selected" : "Place your character"}</Text>
                <Text style={styles.placementInstructions}>
                  {position
                    ? "Tap another clear floor spot to adjust. Join only when you are standing safely."
                    : "Stand at your play spot, then tap the clear floor where your character should be locked."}
                </Text>
              </View>
            </View>
            <View style={styles.safetyRow}>
              <Text style={styles.safetyIcon}>◎</Text>
              <Text style={styles.safetyText}>Keep 1.5 m from others · feet planted during battle</Text>
            </View>
            <Pressable
              accessibilityHint={canJoin ? "Locks your position and marks you waiting" : "Select a floor position first"}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canJoin }}
              disabled={!canJoin}
              onPress={joinBattle}
              style={({ pressed }) => [
                styles.joinButton,
                !canJoin && styles.joinButtonDisabled,
                pressed && canJoin && styles.pressed,
              ]}
            >
              <Text style={[styles.joinText, !canJoin && styles.joinTextDisabled]}>
                {position ? "Lock position and join battle" : "Tap floor to choose position"}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  arView: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },
  topBar: { alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingTop: 8 },
  cameraButton: { alignItems: "center", backgroundColor: colors.cameraScrim, borderRadius: 999, height: 48, justifyContent: "center", width: 48 },
  cameraBack: { color: colors.ink, fontSize: 34, lineHeight: 36, marginTop: -3 },
  trackingPill: { alignItems: "center", backgroundColor: colors.cameraScrim, borderRadius: 999, flex: 1, flexDirection: "row", gap: 8, minHeight: 44, paddingHorizontal: 13 },
  trackingDot: { backgroundColor: colors.accent, borderRadius: 5, height: 10, width: 10 },
  trackingDotReady: { backgroundColor: colors.success },
  trackingText: { color: colors.inkMuted, flex: 1, fontSize: 12, fontWeight: "700" },
  stepPill: { backgroundColor: colors.cameraScrim, borderRadius: 999, color: colors.ink, fontSize: 12, fontWeight: "800", minHeight: 44, paddingHorizontal: 13, paddingTop: 14 },
  placementBody: { flex: 1, justifyContent: "flex-end", padding: 14 },
  reticle: { alignItems: "center", alignSelf: "center", borderColor: colors.accent, borderRadius: 54, borderWidth: 2, height: 92, justifyContent: "center", position: "absolute", top: "37%", width: 92 },
  reticleCenter: { backgroundColor: colors.accent, borderRadius: 5, height: 10, width: 10 },
  placementPanel: { backgroundColor: colors.cameraScrim, borderRadius: 16, padding: 16 },
  placementHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  miniPreview: { height: 86, justifyContent: "flex-end", overflow: "hidden", width: 74 },
  placementCopy: { flex: 1 },
  placementTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  placementInstructions: { color: colors.inkMuted, fontSize: 13, lineHeight: 18, marginTop: 5 },
  safetyRow: { alignItems: "center", backgroundColor: "rgba(255, 204, 77, 0.12)", borderRadius: 10, flexDirection: "row", gap: 9, marginTop: 12, minHeight: 42, paddingHorizontal: 11 },
  safetyIcon: { color: colors.accent, fontSize: 20, fontWeight: "900" },
  safetyText: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: "700" },
  joinButton: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 14, justifyContent: "center", marginTop: 12, minHeight: 56, paddingHorizontal: 14 },
  joinButtonDisabled: { backgroundColor: colors.surfaceStrong },
  joinText: { color: colors.accentInk, fontSize: 16, fontWeight: "900", textAlign: "center" },
  joinTextDisabled: { color: colors.inkMuted },
  waitingScreen: { backgroundColor: colors.background, flex: 1, justifyContent: "space-between", paddingHorizontal: 22 },
  waitingTop: { paddingTop: 38 },
  readyPill: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(108, 229, 168, 0.13)", borderRadius: 999, flexDirection: "row", gap: 8, minHeight: 38, paddingHorizontal: 13 },
  readyDot: { backgroundColor: colors.success, borderRadius: 5, height: 10, width: 10 },
  readyPillText: { color: colors.success, fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  waitingTitle: { color: colors.ink, fontSize: 40, fontWeight: "900", letterSpacing: -1.2, lineHeight: 43, marginTop: 20 },
  waitingBody: { color: colors.inkMuted, fontSize: 16, lineHeight: 23, marginTop: 12, maxWidth: 520 },
  waitingCharacterRow: { alignItems: "center", flexDirection: "row", marginLeft: -14 },
  waitingDetails: { flex: 1, marginLeft: -6 },
  waitingName: { color: colors.ink, fontSize: 27, fontWeight: "900" },
  waitingMeta: { color: colors.inkSubtle, fontSize: 14, marginTop: 4 },
  positionReadout: { backgroundColor: colors.backgroundRaised, borderRadius: 12, marginTop: 16, padding: 13 },
  positionLabel: { color: colors.inkSubtle, fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  positionValue: { color: colors.ink, fontSize: 15, fontWeight: "800", marginTop: 5 },
  waitingFooter: { paddingBottom: 12 },
  organizerStatus: { color: colors.accent, fontSize: 15, fontWeight: "800", marginBottom: 12, textAlign: "center" },
  secondaryButton: { alignItems: "center", borderColor: colors.outline, borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 54 },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
