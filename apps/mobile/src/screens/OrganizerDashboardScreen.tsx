import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ClientEventPayloads, PlayerPublicState, PublicRoomState } from "@codexwars/shared";
import { colors } from "../components/theme";
import type { WarRoomRealtimeClient } from "../features/warRoom/realtimeClient";

type Props = {
  client: WarRoomRealtimeClient;
  connected: boolean;
  onLeave: () => void;
  quizPreview: ClientEventPayloads["quiz_prepared"] | null;
  room: PublicRoomState;
};

export function OrganizerDashboardScreen({ client, connected, onLeave, quizPreview, room }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const players = Object.values(room.players).sort((a, b) => a.playerId.localeCompare(b.playerId));
  const connectedCount = players.filter((player) => player.connected).length;
  const quizReady = room.quiz.status === "ready" || room.quiz.status === "fallback_ready";
  const canStartQuiz = quizReady && players.length > 0 && connectedCount === players.length;
  const question = room.quiz.currentQuestion.id ? room.quiz.currentQuestion : null;

  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  };

  const estimatedServerNow = clock + (room.serverNow - Date.now());
  const seconds = Math.max(0, Math.ceil((room.quiz.questionEndsAt - estimatedServerNow) / 1_000));

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header connected={connected} onLeave={onLeave} />
        {room.phase === "lobby" ? (
          <>
            <View style={styles.hero}><Text style={styles.kicker}>COMMAND CENTER</Text><Text style={styles.heroTitle}>Organizer <Text style={styles.purple}>Dashboard</Text></Text><Text style={styles.copy}>Share the room code, watch participants arrive, then launch the quiz when everyone is present.</Text></View>
            <View style={styles.codePanel}><View><Text style={styles.label}>LIVE ROOM CODE</Text><Text selectable style={styles.code}>{room.roomId}</Text></View><View style={styles.codeGlyph}><Text style={styles.codeGlyphText}>▦</Text></View></View>
            <MetricRow values={[{ label: "JOINED", value: String(players.length) }, { label: "ONLINE", value: `${connectedCount}/${players.length}` }, { label: "STATUS", value: canStartQuiz ? "Ready" : "Waiting" }]} />
            <View style={styles.questionPanel}>
              <Text style={styles.label}>QUIZ PREPARATION</Text>
              <Text style={styles.question}>{room.quiz.status.replaceAll("_", " ").toUpperCase()}</Text>
              <Text style={styles.copy}>{room.quiz.status === "unconfigured" ? "Use the balanced general-knowledge preset, then prepare all ten questions before play." : `${room.quiz.contentMode.replaceAll("_", " ")} · ${room.quiz.category} · ${room.quiz.difficultyProfile}`}</Text>
              {quizPreview ? <View style={styles.preview}>{quizPreview.questions.map((item) => <Text key={item.id} style={styles.previewQuestion}>{item.order}. {item.prompt}</Text>)}</View> : null}
            </View>
            <ParticipantList mode="lobby" players={players} />
            {room.quiz.status === "unconfigured" ? <ActionButton disabled={busy} label={busy ? "Configuring…" : "Configure balanced quiz"} onPress={() => void run(() => client.send({ category: "mixed", contentMode: "mixed", currentEventsLookbackDays: 14, difficultyProfile: "balanced", type: "configure_quiz" }))} /> : null}
            {room.quiz.status === "configured" ? <ActionButton disabled={busy} label={busy ? "Preparing…" : "Prepare quiz"} onPress={() => void run(() => client.send({ type: "prepare_quiz" }))} /> : null}
            {room.quiz.status === "generating" ? <ActionButton disabled={busy} label={busy ? "Cancelling…" : "Cancel preparation"} onPress={() => void run(() => client.send({ type: "cancel_quiz_preparation" }))} /> : null}
            {room.quiz.status === "awaiting_approval" ? <ActionButton disabled={busy} label={busy ? "Approving…" : "Approve quiz"} onPress={() => void run(() => client.send({ type: "approve_quiz" }))} /> : null}
            {(room.quiz.status === "awaiting_approval" || quizReady) ? <ActionButton disabled={busy || room.quiz.regenerationCount >= 2} label="Regenerate quiz" onPress={() => void run(() => client.send({ type: "regenerate_quiz" }))} /> : null}
            {quizReady ? <ActionButton disabled={busy || !canStartQuiz} label={busy ? "Starting…" : canStartQuiz ? "Start quiz  ⚡" : "Waiting for an online participant"} onPress={() => void run(() => client.send({ type: "start_quiz" }))} /> : null}
          </>
        ) : room.phase === "quiz" ? (
          <>
            <SectionTitle kicker="LIVE QUIZ" title="Quiz Control" />
            <View style={styles.progress}>{Array.from({ length: room.quiz.questionCount }, (_, index) => <View key={index} style={[styles.progressDot, index === room.quiz.questionIndex && styles.progressActive, index < room.quiz.questionIndex && styles.progressDone]}><Text style={styles.progressText}>{index + 1}</Text></View>)}</View>
            {question ? (
              <View style={styles.questionPanel}>
                <View style={styles.questionTop}><Text style={styles.gold}>{question.difficulty.toUpperCase()}</Text><Text style={styles.timer}>{room.quiz.status === "question" ? `00:${String(seconds).padStart(2, "0")}` : room.quiz.status.toUpperCase()}</Text></View>
                <Text style={styles.question}>{question.prompt}</Text>
                {question.options.map((option, index) => <View key={option.id} style={[styles.option, room.quiz.status === "reveal" && option.id === room.quiz.revealedCorrectOptionId && styles.optionCorrect]}><Text style={styles.optionKey}>{"ABCD"[index]}</Text><Text style={styles.optionText}>{option.label}</Text></View>)}
              </View>
            ) : <View style={styles.empty}><Text style={styles.emptyTitle}>Quiz complete</Text><Text style={styles.copy}>Participant scores and battle shields are now server-authoritative.</Text></View>}
            <ParticipantList mode="scores" players={players} />
            <ActionButton disabled label="Questions advance automatically on the server" onPress={() => undefined} />
          </>
        ) : null}
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ connected, onLeave }: { connected: boolean; onLeave: () => void }) { return <View style={styles.header}><View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View><Text style={styles.brandText}>CODEX<Text style={styles.purple}>WARS</Text></Text></View><View style={styles.headerRight}><View style={[styles.connectionDot, connected && styles.connectionDotLive]} /><Pressable accessibilityRole="button" onPress={onLeave} style={styles.homeButton}><Text style={styles.homeText}>Home</Text></Pressable></View></View>; }
function SectionTitle({ kicker, title }: { kicker: string; title: string }) { return <View style={styles.sectionHeading}><Text style={styles.kicker}>{kicker}</Text><Text accessibilityRole="header" style={styles.title}>{title}</Text></View>; }
function MetricRow({ values }: { values: { label: string; value: string }[] }) { return <View style={styles.metrics}>{values.map((item) => <View key={item.label} style={styles.metric}><Text style={styles.label}>{item.label}</Text><Text style={styles.metricValue}>{item.value}</Text></View>)}</View>; }
function ParticipantList({ mode, players }: { mode: "lobby" | "scores"; players: PlayerPublicState[] }) { return <View style={styles.roster}><Text style={styles.rosterTitle}>{mode === "lobby" ? "Participant lobby" : "Live scores"}</Text>{players.length === 0 ? <Text style={styles.emptyRoster}>Waiting for the first participant…</Text> : players.map((player) => { const online = player.connected; return <View key={player.playerId} style={styles.player}><View style={styles.avatar}><Text style={styles.avatarText}>{player.displayName.slice(0, 2).toUpperCase()}</Text></View><View style={styles.playerCopy}><Text style={styles.playerName}>{player.displayName}</Text><Text style={styles.playerMeta}>{mode === "lobby" ? online ? "Connected" : "Reconnecting" : `${player.correctAnswers} correct`}</Text></View><Text style={[styles.ready, mode === "lobby" && !online && styles.notReady]}>{mode === "lobby" ? online ? "ONLINE" : "OFFLINE" : `${player.correctAnswers}/10`}</Text></View>; })}</View>; }
function ActionButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.actionText}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 }, scroll: { paddingBottom: 36, paddingHorizontal: 20 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 64 }, brand: { alignItems: "center", flexDirection: "row", gap: 9 }, brandMark: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, height: 34, justifyContent: "center", width: 34 }, brandMarkText: { color: colors.ink, fontSize: 18, fontWeight: "900" }, brandText: { color: colors.ink, fontSize: 14, fontWeight: "900", letterSpacing: 1 }, purple: { color: colors.accent }, headerRight: { alignItems: "center", flexDirection: "row", gap: 10 }, connectionDot: { backgroundColor: colors.danger, borderRadius: 5, height: 10, width: 10 }, connectionDotLive: { backgroundColor: colors.success }, homeButton: { borderColor: colors.outline, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 13 }, homeText: { color: colors.inkMuted, fontSize: 12, fontWeight: "800" },
  hero: { marginBottom: 24, marginTop: 46 }, kicker: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }, heroTitle: { color: colors.ink, fontSize: 40, fontWeight: "900", letterSpacing: -1.5, lineHeight: 45, marginTop: 8 }, copy: { color: colors.inkMuted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  codePanel: { alignItems: "center", backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 16, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 18 }, label: { color: colors.inkMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, code: { color: colors.success, fontSize: 28, fontWeight: "900", letterSpacing: 4, marginTop: 5 }, codeGlyph: { alignItems: "center", backgroundColor: colors.surfaceStrong, borderRadius: 12, height: 64, justifyContent: "center", width: 64 }, codeGlyphText: { color: colors.ink, fontSize: 28 },
  metrics: { flexDirection: "row", gap: 8, marginVertical: 14 }, metric: { backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 14, borderWidth: 1, flex: 1, minHeight: 80, padding: 12 }, metricValue: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 10 },
  roster: { marginTop: 8 }, rosterTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: 10 }, emptyRoster: { color: colors.inkMuted, fontSize: 14, paddingVertical: 22 }, player: { alignItems: "center", backgroundColor: colors.backgroundRaised, borderBottomColor: colors.outline, borderBottomWidth: 1, flexDirection: "row", minHeight: 68, paddingHorizontal: 12 }, avatar: { alignItems: "center", backgroundColor: colors.surfaceStrong, borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, avatarText: { color: colors.ink, fontSize: 10, fontWeight: "900" }, playerCopy: { flex: 1, marginLeft: 11 }, playerName: { color: colors.ink, fontSize: 14, fontWeight: "800" }, playerMeta: { color: colors.inkMuted, fontSize: 11, marginTop: 3 }, ready: { color: colors.success, fontSize: 10, fontWeight: "900" }, notReady: { color: colors.danger },
  action: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 13, justifyContent: "center", marginTop: 18, minHeight: 56 }, actionText: { color: colors.ink, fontSize: 15, fontWeight: "900" }, disabled: { opacity: 0.42 }, pressed: { opacity: 0.8 }, error: { color: colors.danger, fontSize: 13, marginTop: 12, textAlign: "center" },
  sectionHeading: { marginBottom: 18, marginTop: 26 }, title: { color: colors.ink, fontSize: 34, fontWeight: "900", letterSpacing: -1, marginTop: 7 }, progress: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 17 }, progressDot: { alignItems: "center", backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 12, borderWidth: 1, height: 29, justifyContent: "center", width: 29 }, progressActive: { backgroundColor: colors.accent }, progressDone: { backgroundColor: "rgba(72, 229, 232, 0.16)", borderColor: colors.success }, progressText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  questionPanel: { backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 16, borderWidth: 1, padding: 17 }, questionTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, gold: { color: "#FFD166", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, timer: { color: colors.success, fontSize: 15, fontWeight: "900" }, question: { color: colors.ink, fontSize: 20, fontWeight: "900", lineHeight: 27, marginBottom: 12, marginTop: 15 }, option: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.outline, borderRadius: 11, borderWidth: 1, flexDirection: "row", marginTop: 7, minHeight: 50, paddingHorizontal: 10 }, optionCorrect: { backgroundColor: "rgba(72, 229, 232, 0.14)", borderColor: colors.success }, optionKey: { backgroundColor: colors.surfaceStrong, borderRadius: 7, color: colors.ink, fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 6 }, optionText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700", marginLeft: 10 }, empty: { backgroundColor: colors.backgroundRaised, borderRadius: 16, padding: 18 }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  preview: { borderTopColor: colors.outline, borderTopWidth: 1, gap: 7, marginTop: 14, paddingTop: 12 }, previewQuestion: { color: colors.inkMuted, fontSize: 12, lineHeight: 17 },
});
