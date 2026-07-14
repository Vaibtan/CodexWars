import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import type { WarRoomState } from "@codexwars/shared";
import { colors } from "../components/theme";
import { getCharacter, getCharacterColor } from "../features/characters/characterCatalog";
import type { WarRoomSession } from "../features/warRoom/types";
import { endBattle, setArenaReady, startBattle } from "../lib/firebase/warRooms";
import { FloorScanScene } from "./scenes/FloorScanScene";
import type { ArFlowPhase, ArSceneBridge, ArTrackingState } from "./types";

type ArDemoScreenProps = {
  onBattleComplete: () => void;
  onExit: () => void;
  room: WarRoomState;
  session: WarRoomSession;
};

const trackingCopy: Record<ArTrackingState, string> = {
  initializing: "Starting camera…",
  limited: "Move slowly and aim at a textured floor",
  normal: "Tracking stable",
  unavailable: "Tracking unavailable",
};

export function ArDemoScreen({ onBattleComplete, onExit, room, session }: ArDemoScreenProps) {
  const [phase, setPhase] = useState<ArFlowPhase>("floor-scan");
  const [floorFound, setFloorFound] = useState(false);
  const [trackingState, setTrackingState] = useState<ArTrackingState>("initializing");
  const [syncError, setSyncError] = useState<string | null>(null);
  const participants = Object.values(room.members);
  const readyParticipants = participants.filter((participant) => participant.readiness === "waiting");

  const sceneBridge = useMemo<ArSceneBridge>(
    () => ({
      onFloorFound: () => setFloorFound(true),
      onTrackingChanged: setTrackingState,
    }),
    [],
  );

  useEffect(() => {
    if (room.phase === "battle") setPhase("battle");
    if (room.phase === "results") onBattleComplete();
  }, [onBattleComplete, room.phase]);

  const openOrganizerLobby = async () => {
    if (!floorFound) {
      return;
    }
    setSyncError(null);
    try {
      await setArenaReady(session, room);
      setPhase("organizer-lobby");
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : String(error));
    }
  };

  const enterBattle = async () => {
    if (readyParticipants.length < 2) {
      return;
    }
    setSyncError(null);
    try {
      await startBattle(session, room);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <View style={styles.screen}>
      <ViroARSceneNavigator
        initialScene={{ scene: FloorScanScene }}
        style={styles.arView}
        viroAppProps={sceneBridge}
      />
      {phase === "organizer-lobby" ? <View style={styles.lobbyBackdrop} /> : null}

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
                {
                  backgroundColor:
                    phase === "organizer-lobby"
                      ? colors.inkSubtle
                      : trackingState === "normal"
                        ? colors.success
                        : colors.accent,
                },
              ]}
            />
            <Text numberOfLines={1} style={styles.statusText}>
              {phase === "organizer-lobby" ? "Arena locked · realtime lobby" : trackingCopy[trackingState]}
            </Text>
          </View>
          <View style={styles.phasePill}>
              <Text style={styles.phaseText}>
                {phase === "battle" ? "00:60" : phase === "organizer-lobby" ? "LOBBY" : "HOST"}
              </Text>
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
                onPress={() => void openOrganizerLobby()}
                style={({ pressed }) => [
                  styles.continueButton,
                  !floorFound && styles.continueButtonDisabled,
                  pressed && floorFound && styles.controlPressed,
                ]}
              >
                <Text style={styles.continueButtonText}>
                  {floorFound ? "Use floor and open lobby" : "Looking for floor…"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : phase === "organizer-lobby" ? (
          <View style={styles.organizerLobby}>
            <View style={styles.lobbyPanel}>
              <View style={styles.lobbyHeadingRow}>
                <View>
                  <Text style={styles.panelKicker}>Organizer lobby</Text>
                  <Text style={styles.panelTitle}>Players waiting</Text>
                </View>
                <View style={styles.readyCount}>
                  <Text style={styles.readyCountText}>{readyParticipants.length} / {participants.length}</Text>
                </View>
              </View>
              <Text style={styles.panelBody}>
                Start remains locked until every combat participant has localized and fixed a safe position.
              </Text>

              {participants.map((participant) => {
                const ready = participant.readiness === "waiting";
                const detail = participant.selection
                  ? `${getCharacter(participant.selection.characterId).displayName} · ${getCharacterColor(participant.selection.colorId).label}`
                  : participant.quizCompleted ? "Choosing character" : "Quiz in progress";
                return (
                <View key={participant.id} style={styles.lobbyPlayerRow}>
                  <View style={[styles.playerStatusDot, !ready && styles.playerStatusDotPending]} />
                  <View style={styles.lobbyPlayerCopy}>
                    <Text style={styles.lobbyPlayerName}>{participant.nickname}</Text>
                    <Text style={styles.lobbyPlayerDetail}>{detail}</Text>
                  </View>
                  <Text style={[styles.lobbyPlayerState, !ready && styles.lobbyPlayerStatePending]}>
                    {ready ? "WAITING" : "NOT READY"}
                  </Text>
                </View>
              )})}

              <Pressable
                accessibilityHint={readyParticipants.length >= 2 ? "Starts the battle for all waiting players" : "At least two participants must be ready"}
                accessibilityRole="button"
                accessibilityState={{ disabled: readyParticipants.length < 2 }}
                disabled={readyParticipants.length < 2}
                onPress={() => void enterBattle()}
                style={({ pressed }) => [
                  styles.continueButton,
                  readyParticipants.length < 2 && styles.continueButtonDisabled,
                  pressed && readyParticipants.length >= 2 && styles.controlPressed,
                ]}
              >
                <Text style={styles.continueButtonText}>
                  {readyParticipants.length >= 2 ? "Start battle" : `Waiting for players · ${readyParticipants.length}/2`}
                </Text>
              </Pressable>
              {syncError ? <Text accessibilityLiveRegion="assertive" style={styles.syncError}>{syncError}</Text> : null}
            </View>
          </View>
        ) : (
          <View pointerEvents="box-none" style={styles.battleContent}>
            <View style={styles.organizerBattlePanel}>
              <View style={styles.organizerBattleCopy}>
                <Text style={styles.healthLabel}>ORGANIZER VIEW</Text>
                <Text style={styles.organizerBattleTitle}>Battle in progress</Text>
                <Text style={styles.organizerBattleDetail}>{participants.length} players synchronized · room {room.code}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => void endBattle(session, room).catch((error: unknown) => setSyncError(error instanceof Error ? error.message : String(error)))}
                style={({ pressed }) => [styles.endBattleButton, pressed && styles.controlPressed]}
              >
                <Text style={styles.endBattleButtonText}>End battle</Text>
              </Pressable>
            </View>
            <View style={styles.organizerRoster}>
              <Text style={styles.organizerRosterTitle}>Live Battle Snapshot</Text>
              {participants.map((participant) => (
                <Text key={participant.id} style={styles.organizerRosterRow}>
                  {participant.nickname} · {room.stats[participant.id]?.eliminated ? "eliminated" : `${room.stats[participant.id]?.hp ?? 0} HP`}
                </Text>
              ))}
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
  lobbyBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background },
  syncError: { color: colors.danger, fontSize: 12, marginTop: 10, textAlign: "center" },
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
  organizerBattlePanel: { alignItems: "center", backgroundColor: colors.cameraScrim, flexDirection: "row", left: 14, padding: 14, position: "absolute", right: 14, top: 76 },
  organizerBattleCopy: { flex: 1 },
  organizerBattleTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 3 },
  organizerBattleDetail: { color: colors.inkMuted, fontSize: 12, marginTop: 3 },
  endBattleButton: { alignItems: "center", borderColor: colors.danger, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 14 },
  endBattleButtonText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  organizerRoster: { backgroundColor: colors.cameraScrim, gap: 8, margin: 14, padding: 16 },
  organizerRosterTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginBottom: 2 },
  organizerRosterRow: { color: colors.inkMuted, fontSize: 14, fontWeight: "700" },
  organizerLobby: { flex: 1, justifyContent: "flex-end", padding: 14 },
  lobbyPanel: { backgroundColor: colors.cameraScrim, borderRadius: 16, padding: 17 },
  lobbyHeadingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  readyCount: { alignItems: "center", backgroundColor: colors.surfaceStrong, borderRadius: 999, justifyContent: "center", minHeight: 40, minWidth: 64, paddingHorizontal: 12 },
  readyCountText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  lobbyPlayerRow: { alignItems: "center", borderBottomColor: colors.outline, borderBottomWidth: 1, flexDirection: "row", minHeight: 62 },
  playerStatusDot: { backgroundColor: colors.success, borderRadius: 6, height: 12, width: 12 },
  playerStatusDotPending: { backgroundColor: colors.accent },
  lobbyPlayerCopy: { flex: 1, marginLeft: 11 },
  lobbyPlayerName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  lobbyPlayerDetail: { color: colors.inkSubtle, fontSize: 11, marginTop: 3 },
  lobbyPlayerState: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  lobbyPlayerStatePending: { color: colors.accent },
  healthLabel: { color: colors.inkSubtle, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
});
