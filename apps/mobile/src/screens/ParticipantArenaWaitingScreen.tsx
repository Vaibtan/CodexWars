import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CharacterSelection, WarRoomState } from "@codexwars/shared";
import { colors } from "../components/theme";

type Props = {
  connected: boolean;
  onChangeCharacter: () => void;
  onLeave: () => void;
  room: WarRoomState;
  selection: CharacterSelection;
};

export function ParticipantArenaWaitingScreen({ connected, onChangeCharacter, onLeave, room, selection }: Props) {
  const arenaStatus = room.arena.status === "scanning" ? "Organizer is scanning" : "Waiting for organizer to scan";
  return <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
    <View style={styles.connection}><View style={[styles.dot, connected && styles.dotLive]} /><Text style={styles.connectionText}>{connected ? "Realtime sync connected" : "Reconnecting…"}</Text></View>
    <View style={styles.content}>
      <Text style={styles.kicker}>BATTLE SETUP · ROOM {room.code}</Text>
      <Text accessibilityRole="header" style={styles.title}>Waiting for the play area.</Text>
      <Text style={styles.body}>Your organizer is mapping a safe arena. You’ll move to AR position locking automatically when the play area is ready.</Text>
      <View style={styles.scanCard}><View style={styles.radar}><View style={styles.radarInner} /><View style={styles.radarCore} /></View><Text style={styles.scanTitle}>{arenaStatus}</Text><Text style={styles.scanMeta}>Character: {selection.characterId} · {selection.colorId}</Text></View>
    </View>
    <Pressable accessibilityRole="button" onPress={onChangeCharacter} style={styles.primary}><Text style={styles.primaryText}>Change character or color</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onLeave} style={styles.secondary}><Text style={styles.secondaryText}>Leave War Room</Text></Pressable>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1, paddingHorizontal: 22 },
  connection: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 58 },
  dot: { backgroundColor: colors.danger, borderRadius: 5, height: 10, width: 10 },
  dotLive: { backgroundColor: colors.success },
  connectionText: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  content: { flex: 1, justifyContent: "center" },
  kicker: { color: colors.success, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 39, fontWeight: "900", letterSpacing: -1.2, lineHeight: 44, marginTop: 12 },
  body: { color: colors.inkMuted, fontSize: 15, lineHeight: 23, marginTop: 14 },
  scanCard: { alignItems: "center", backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 18, borderWidth: 1, marginTop: 28, padding: 24 },
  radar: { alignItems: "center", borderColor: colors.accent, borderRadius: 50, borderWidth: 2, height: 100, justifyContent: "center", width: 100 },
  radarInner: { borderColor: colors.success, borderRadius: 31, borderWidth: 1, height: 62, position: "absolute", width: 62 },
  radarCore: { backgroundColor: colors.success, borderRadius: 7, height: 14, width: 14 },
  scanTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginTop: 18 },
  scanMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 7, textTransform: "capitalize" },
  primary: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 14, justifyContent: "center", minHeight: 56 },
  primaryText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  secondary: { alignItems: "center", borderColor: colors.outline, borderRadius: 14, borderWidth: 1, justifyContent: "center", marginBottom: 10, marginTop: 10, minHeight: 50 },
  secondaryText: { color: colors.inkMuted, fontSize: 14, fontWeight: "800" },
});
