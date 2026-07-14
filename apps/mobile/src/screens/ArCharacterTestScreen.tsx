import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ArenaPosition, CharacterSelection } from "@codexwars/shared";
import { ParticipantPlacementArView } from "../ar/ParticipantPlacementArView";
import type { ArSceneBridge, ArTrackingState } from "../ar/types";
import { colors } from "../components/theme";

const TEST_CHARACTER: CharacterSelection = { characterId: "knight", colorId: "gold" };

const trackingCopy: Record<ArTrackingState, string> = {
  initializing: "Starting AR…",
  limited: "Move slowly and point at a textured floor",
  normal: "Floor ready · tap to place Aegis",
  unavailable: "AR tracking unavailable",
};

export function ArCharacterTestScreen({ onDone }: { onDone: () => void }) {
  const [position, setPosition] = useState<ArenaPosition | null>(null);
  const [tracking, setTracking] = useState<ArTrackingState>("initializing");
  const bridge = useMemo<ArSceneBridge>(() => ({
    characterSelection: TEST_CHARACTER,
    onPlacementChanged: setPosition,
    onTrackingChanged: setTracking,
  }), []);

  return (
    <View style={styles.screen}>
      <ParticipantPlacementArView bridge={bridge} selection={TEST_CHARACTER} />
      <SafeAreaView edges={["top", "bottom"]} pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" style={styles.topRow}>
          <Pressable accessibilityLabel="Close AR test" accessibilityRole="button" onPress={onDone} style={styles.closeButton}>
            <Text style={styles.closeText}>‹</Text>
          </Pressable>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, tracking === "normal" && styles.statusDotReady]} />
            <Text numberOfLines={1} style={styles.statusText}>{trackingCopy[tracking]}</Text>
          </View>
        </View>

        <View pointerEvents="none" style={styles.guide}>
          <Text style={styles.kicker}>AR CHARACTER TEST</Text>
          <Text style={styles.title}>{position ? "Aegis is in your room" : "Find a clear floor"}</Text>
          <Text style={styles.body}>
            {position
              ? `Placed at X ${position.x.toFixed(2)} m · Z ${position.z.toFixed(2)} m. Tap another floor spot to move it.`
              : "Move the phone slowly until tracking is ready, then tap a detected floor to place the 3D character."}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  topRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingTop: 8 },
  closeButton: { alignItems: "center", backgroundColor: colors.cameraScrim, borderRadius: 999, height: 48, justifyContent: "center", width: 48 },
  closeText: { color: colors.ink, fontSize: 34, lineHeight: 36, marginTop: -3 },
  statusPill: { alignItems: "center", backgroundColor: colors.cameraScrim, borderRadius: 999, flex: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 14 },
  statusDot: { backgroundColor: colors.accent, borderRadius: 5, height: 10, width: 10 },
  statusDotReady: { backgroundColor: colors.success },
  statusText: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800" },
  guide: { backgroundColor: colors.cameraScrim, borderRadius: 18, margin: 14, padding: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "900", marginTop: 7 },
  body: { color: colors.inkMuted, fontSize: 14, lineHeight: 20, marginTop: 7 },
});
