import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PublicRoomState } from "@codexwars/shared";
import { BattleStatsPanel } from "../components/BattleStatsPanel";
import { CharacterPreview } from "../components/CharacterPreview";
import { colors } from "../components/theme";
import type { ArMarkerTrackingState, ArTrackingState } from "../ar/types";
import { getCharacter, getCharacterColor } from "../features/characters/characterCatalog";
import type { ArenaPosition, CharacterSelection } from "../features/characters/types";
import type { WarRoomRealtimeClient } from "../features/warRoom/realtimeClient";

type ParticipantPlacementScreenProps = {
  client: WarRoomRealtimeClient;
  markerTracking: ArMarkerTrackingState;
  onBack: () => void;
  onReturnHome: () => void;
  onStartBattle: () => void;
  position: ArenaPosition | null;
  room: PublicRoomState;
  selection: CharacterSelection;
  tracking: ArTrackingState;
};

const trackingCopy: Record<ArTrackingState, string> = {
  initializing: "Starting camera…",
  limited: "Move slowly and keep the floor visible",
  normal: "Floor tracking stable",
  unavailable: "Tracking unavailable",
};

export function ParticipantPlacementScreen({
  client,
  markerTracking,
  onBack,
  onReturnHome,
  onStartBattle,
  position,
  room,
  selection,
  tracking,
}: ParticipantPlacementScreenProps) {
  const [waiting, setWaiting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const character = getCharacter(selection.characterId);
  const characterColor = getCharacterColor(selection.colorId);
  const player = client.session.playerId === null ? undefined : room.players[client.session.playerId];

  useEffect(() => {
    if (room.phase === "battle") onStartBattle();
  }, [onStartBattle, room.phase]);

  useEffect(() => {
    if (player?.positionLocked && player.ready) setWaiting(true);
  }, [player?.positionLocked, player?.ready]);

  useEffect(() => {
    if (!player || (room.phase !== "localization" && room.phase !== "positioning")) return;
    const desiredLocalization = markerTracking === "tracked" || markerTracking === "degraded"
      ? "localized"
      : markerTracking === "lost"
        ? "lost"
        : "searching";
    if (player.localization === desiredLocalization) return;
    void client.send({ state: desiredLocalization, type: "localization_changed" }).catch((error: unknown) => {
      setSyncError(error instanceof Error ? error.message : String(error));
    });
  }, [client, markerTracking, player, room.phase]);

  const joinBattle = async () => {
    if (!position || tracking !== "normal") {
      return;
    }
    setSyncError(null);
    try {
      await client.send({ position, type: "lock_position" });
      await client.send({ ready: true, type: "ready_changed" });
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : String(error));
    }
  };

  if (waiting) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={[styles.waitingScreen, styles.waitingOverlay]}>
        <ScrollView contentContainerStyle={styles.waitingContent} showsVerticalScrollIndicator={false}>
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

          {player ? <BattleStatsPanel label="Quiz powers ready" player={player} /> : null}

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
            <Text style={styles.waitingHint}>Battle opens automatically when the organizer starts.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onReturnHome}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Return to demo home</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const selectionSynced = player?.characterId === selection.characterId
    && player.characterColorId === selection.colorId;
  const canJoin = Boolean(position)
    && tracking === "normal"
    && markerTracking === "tracked"
    && selectionSynced
    && room.arena.configured
    && room.phase === "positioning";

  return (
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
            <Text numberOfLines={1} style={styles.trackingText}>
              {markerTracking === "tracked" ? "Arena marker locked" : markerTracking === "degraded" ? "Marker pose retained" : markerTracking === "lost" ? "Marker lost · scan again" : trackingCopy[tracking]}
            </Text>
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
                <Text style={styles.placementTitle}>{position ? "Standing position found" : "Find the arena marker"}</Text>
                <Text style={styles.placementInstructions}>
                  {position
                    ? "Stand still at this safe spot. The coordinates below come from your camera relative to the printed marker."
                    : "Point at the printed marker, then stand at your play spot while keeping the AR session open."}
                </Text>
              </View>
            </View>
            <View style={styles.safetyRow}>
              <Text style={styles.safetyIcon}>◎</Text>
              <Text style={styles.safetyText}>Keep 1.5 m from others · feet planted during battle</Text>
            </View>
            <Pressable
              accessibilityHint={canJoin ? "Locks your marker-relative standing position and marks you waiting" : "Scan the marker from a safe standing position first"}
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
                {room.phase === "localization" ? "Waiting for arena positioning…" : position ? "Lock this standing position" : "Scan marker to locate your position"}
              </Text>
            </Pressable>
            {syncError ? <Text accessibilityLiveRegion="assertive" style={styles.syncError}>{syncError}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
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
  waitingScreen: { backgroundColor: colors.background, flex: 1 },
  waitingOverlay: { ...StyleSheet.absoluteFillObject },
  waitingContent: { gap: 20, paddingBottom: 12, paddingHorizontal: 22 },
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
  waitingHint: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginBottom: 12, textAlign: "center" },
  syncError: { color: colors.danger, fontSize: 12, marginTop: 8, textAlign: "center" },
  secondaryButton: { alignItems: "center", borderColor: colors.outline, borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 54 },
  startButton: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 14, justifyContent: "center", marginBottom: 10, minHeight: 56, paddingHorizontal: 16 },
  startButtonText: { color: colors.accentInk, fontSize: 16, fontWeight: "900", textAlign: "center" },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
