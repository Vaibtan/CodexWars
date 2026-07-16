import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PublicRoomState } from "@codexwars/shared";
import type { WarRoomSession } from "../features/warRoom/types";
import { colors } from "../components/theme";

type QuizWaitingScreenProps = {
  connected: boolean;
  onLeave: () => void;
  room: PublicRoomState | null;
  session: WarRoomSession;
};

export function QuizWaitingScreen({ connected, onLeave, room, session }: QuizWaitingScreenProps) {
  const participant = session.playerId === null ? undefined : room?.players[session.playerId];
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, connected && styles.dotConnected]} />
        <Text style={styles.status}>{connected ? "Realtime sync connected" : "Connecting to War Room…"}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.kicker}>ROOM {session.roomId}</Text>
        <Text accessibilityRole="header" style={styles.title}>{room?.phase === "lobby" ? "Ready for the quiz?" : "Quiz starting…"}</Text>
        <Text style={styles.body}>
          {room?.phase === "lobby" ? "You are admitted to the live room. The organizer can start when all expected participants have joined." : "Stay here. The first question appears automatically when the organizer starts the quiz."}
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PARTICIPANT</Text>
          <Text style={styles.cardValue}>{participant?.displayName ?? session.nickname}</Text>
          <Text style={[styles.cardMeta, connected && styles.readyText]}>{connected ? "CONNECTED" : "RECONNECTING"}</Text>
        </View>
        {room?.phase === "lobby" ? <View style={styles.readyButton}><Text style={styles.readyButtonText}>Waiting for organizer…</Text></View> : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onLeave} style={styles.leaveButton}>
        <Text style={styles.leaveText}>Leave War Room</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1, paddingHorizontal: 22 },
  statusRow: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 58 },
  dot: { backgroundColor: colors.accent, borderRadius: 5, height: 10, width: 10 },
  dotConnected: { backgroundColor: colors.success },
  status: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  content: { flex: 1, justifyContent: "center" },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 42, fontWeight: "900", letterSpacing: -1.2, marginTop: 12 },
  body: { color: colors.inkMuted, fontSize: 16, lineHeight: 24, marginTop: 14 },
  card: { backgroundColor: colors.backgroundRaised, borderRadius: 16, marginTop: 28, padding: 18 },
  cardLabel: { color: colors.inkSubtle, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  cardValue: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: 7 },
  cardMeta: { color: colors.accent, fontSize: 13, fontWeight: "700", marginTop: 6 },
  readyText: { color: colors.success },
  readyButton: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 14, justifyContent: "center", marginTop: 16, minHeight: 56 },
  readyButtonText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  error: { color: colors.danger, fontSize: 13, marginTop: 12, textAlign: "center" },
  leaveButton: { alignItems: "center", borderColor: colors.outline, borderRadius: 14, borderWidth: 1, justifyContent: "center", marginBottom: 12, minHeight: 54 },
  leaveText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
});
