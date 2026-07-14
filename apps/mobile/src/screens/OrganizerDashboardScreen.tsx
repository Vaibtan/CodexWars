import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { WarRoomState } from "@codexwars/shared";
import { colors } from "../components/theme";
import { getQuizQuestion, quizCatalog } from "../features/quiz/quizCatalog";
import type { WarRoomSession } from "../features/warRoom/types";
import { completeQuiz, openQuizQuestion, scoreQuizQuestion, startBattleSetup, startQuiz } from "../lib/firebase/warRooms";

type Props = {
  connected: boolean;
  onLeave: () => void;
  room: WarRoomState;
  session: WarRoomSession;
};

export function OrganizerDashboardScreen({ connected, onLeave, room, session }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const members = Object.values(room.members).sort((a, b) => a.joinedAt - b.joinedAt);
  const readyCount = members.filter((member) => member.connected && member.readiness === "quiz-ready").length;
  const everyoneReady = members.length > 0 && readyCount === members.length;
  const question = getQuizQuestion(room.quiz.currentQuestionId);

  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  };

  const openNext = () => {
    const next = quizCatalog[room.quiz.completedQuestionCount];
    if (!next) return;
    void run(() => openQuizQuestion(session, room, next.id, room.quiz.completedQuestionCount, Date.now() + next.durationMs));
  };

  const seconds = Math.max(0, Math.ceil(((room.quiz.questionEndsAt ?? clock) - clock) / 1_000));

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header connected={connected} onLeave={onLeave} />
        {room.phase === "lobby" ? (
          <>
            <View style={styles.hero}><Text style={styles.kicker}>COMMAND CENTER</Text><Text style={styles.heroTitle}>Organizer <Text style={styles.purple}>Dashboard</Text></Text><Text style={styles.copy}>Share the room code, watch participants arrive, then launch the quiz when everyone is present.</Text></View>
            <View style={styles.codePanel}><View><Text style={styles.label}>LIVE ROOM CODE</Text><Text selectable style={styles.code}>{room.code}</Text></View><View style={styles.codeGlyph}><Text style={styles.codeGlyphText}>▦</Text></View></View>
            <MetricRow values={[{ label: "JOINED", value: String(members.length) }, { label: "READY", value: `${readyCount}/${members.length}` }, { label: "STATUS", value: everyoneReady ? "Ready" : "Waiting" }]} />
            <ParticipantList members={members} mode="lobby" />
            <ActionButton disabled={busy || !everyoneReady} label={busy ? "Starting…" : everyoneReady ? "Start quiz  ⚡" : `Waiting for ${members.length - readyCount} participant${members.length - readyCount === 1 ? "" : "s"}`} onPress={() => void run(() => startQuiz(session, room))} />
          </>
        ) : room.phase === "quiz" ? (
          <>
            <SectionTitle kicker="LIVE QUIZ" title="Quiz Control" />
            <View style={styles.progress}>{quizCatalog.map((item, index) => <View key={item.id} style={[styles.progressDot, index === room.quiz.currentQuestionIndex && styles.progressActive, index < room.quiz.completedQuestionCount && styles.progressDone]}><Text style={styles.progressText}>{index + 1}</Text></View>)}</View>
            {question ? (
              <View style={styles.questionPanel}>
                <View style={styles.questionTop}><Text style={styles.gold}>{question.topic}</Text><Text style={styles.timer}>{room.quiz.status === "open" ? `00:${String(seconds).padStart(2, "0")}` : room.quiz.status.toUpperCase()}</Text></View>
                <Text style={styles.question}>{question.prompt}</Text>
                {question.options.map((option, index) => <View key={option.id} style={[styles.option, room.quiz.status === "reveal" && option.id === room.quiz.correctOptionId && styles.optionCorrect]}><Text style={styles.optionKey}>{"ABCD"[index]}</Text><Text style={styles.optionText}>{option.label}</Text></View>)}
              </View>
            ) : <View style={styles.empty}><Text style={styles.emptyTitle}>Ready for question one</Text><Text style={styles.copy}>Open each question when participants are ready. Answers remain private until you reveal them.</Text></View>}
            <ParticipantList members={members} mode="scores" />
            {room.quiz.status === "waiting" || room.quiz.status === "reveal" ? (
              room.quiz.completedQuestionCount === 10
                ? <ActionButton disabled={busy} label="Finish quiz  →" onPress={() => void run(() => completeQuiz(session, room))} />
                : <ActionButton disabled={busy} label={`Open question ${room.quiz.completedQuestionCount + 1}  →`} onPress={openNext} />
            ) : room.quiz.status === "open" && question ? (
              <ActionButton disabled={busy} label="Close and reveal answers" onPress={() => void run(() => scoreQuizQuestion(session, room, question.correctOptionId, Date.now() + 5_000))} />
            ) : <ActionButton disabled label="Scoring answers…" onPress={() => undefined} />}
          </>
        ) : room.phase === "quiz-results" ? (
          <>
            <SectionTitle kicker="QUIZ COMPLETE" title="Top minds rise." />
            <Text style={styles.copy}>{members.length} participants completed ten questions. Their battle stats are now locked.</Text>
            <ParticipantList members={members} mode="results" room={room} />
            <ActionButton disabled={busy} label="Move to battle setup  ⚔" onPress={() => void run(() => startBattleSetup(session, room))} />
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
function ParticipantList({ members, mode, room }: { members: WarRoomState["members"][string][]; mode: "lobby" | "scores" | "results"; room?: WarRoomState }) { const ordered = mode === "results" ? [...members].sort((a, b) => (b.correctAnswers ?? 0) - (a.correctAnswers ?? 0) || a.joinedAt - b.joinedAt) : members; return <View style={styles.roster}><Text style={styles.rosterTitle}>{mode === "lobby" ? "Participant lobby" : mode === "scores" ? "Live scores" : "Quiz rankings"}</Text>{ordered.length === 0 ? <Text style={styles.emptyRoster}>Waiting for the first participant…</Text> : ordered.map((member, index) => { const ready = member.connected && member.readiness === "quiz-ready"; return <View key={member.id} style={styles.player}><View style={styles.avatar}><Text style={styles.avatarText}>{member.nickname.slice(0, 2).toUpperCase()}</Text></View><View style={styles.playerCopy}><Text style={styles.playerName}>{member.nickname}</Text><Text style={styles.playerMeta}>{mode === "lobby" ? member.connected ? "Connected" : "Reconnecting" : `${member.correctAnswers ?? room?.quiz.scores[member.id] ?? 0} correct`}</Text></View>{mode === "results" ? <Text style={styles.rank}>#{index + 1}</Text> : <Text style={[styles.ready, mode === "lobby" && !ready && styles.notReady]}>{mode === "lobby" ? ready ? "READY" : "NOT READY" : `${room?.quiz.scores[member.id] ?? 0}/10`}</Text>}</View>; })}</View>; }
function ActionButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.actionText}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 }, scroll: { paddingBottom: 36, paddingHorizontal: 20 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 64 }, brand: { alignItems: "center", flexDirection: "row", gap: 9 }, brandMark: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, height: 34, justifyContent: "center", width: 34 }, brandMarkText: { color: colors.ink, fontSize: 18, fontWeight: "900" }, brandText: { color: colors.ink, fontSize: 14, fontWeight: "900", letterSpacing: 1 }, purple: { color: colors.accent }, headerRight: { alignItems: "center", flexDirection: "row", gap: 10 }, connectionDot: { backgroundColor: colors.danger, borderRadius: 5, height: 10, width: 10 }, connectionDotLive: { backgroundColor: colors.success }, homeButton: { borderColor: colors.outline, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 13 }, homeText: { color: colors.inkMuted, fontSize: 12, fontWeight: "800" },
  hero: { marginBottom: 24, marginTop: 46 }, kicker: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }, heroTitle: { color: colors.ink, fontSize: 40, fontWeight: "900", letterSpacing: -1.5, lineHeight: 45, marginTop: 8 }, copy: { color: colors.inkMuted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  codePanel: { alignItems: "center", backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 16, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 18 }, label: { color: colors.inkMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, code: { color: colors.success, fontSize: 28, fontWeight: "900", letterSpacing: 4, marginTop: 5 }, codeGlyph: { alignItems: "center", backgroundColor: colors.surfaceStrong, borderRadius: 12, height: 64, justifyContent: "center", width: 64 }, codeGlyphText: { color: colors.ink, fontSize: 28 },
  metrics: { flexDirection: "row", gap: 8, marginVertical: 14 }, metric: { backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 14, borderWidth: 1, flex: 1, minHeight: 80, padding: 12 }, metricValue: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 10 },
  roster: { marginTop: 8 }, rosterTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: 10 }, emptyRoster: { color: colors.inkMuted, fontSize: 14, paddingVertical: 22 }, player: { alignItems: "center", backgroundColor: colors.backgroundRaised, borderBottomColor: colors.outline, borderBottomWidth: 1, flexDirection: "row", minHeight: 68, paddingHorizontal: 12 }, avatar: { alignItems: "center", backgroundColor: colors.surfaceStrong, borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, avatarText: { color: colors.ink, fontSize: 10, fontWeight: "900" }, playerCopy: { flex: 1, marginLeft: 11 }, playerName: { color: colors.ink, fontSize: 14, fontWeight: "800" }, playerMeta: { color: colors.inkMuted, fontSize: 11, marginTop: 3 }, ready: { color: colors.success, fontSize: 10, fontWeight: "900" }, notReady: { color: colors.danger }, rank: { color: colors.accent, fontSize: 17, fontWeight: "900" },
  action: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 13, justifyContent: "center", marginTop: 18, minHeight: 56 }, actionText: { color: colors.ink, fontSize: 15, fontWeight: "900" }, disabled: { opacity: 0.42 }, pressed: { opacity: 0.8 }, error: { color: colors.danger, fontSize: 13, marginTop: 12, textAlign: "center" },
  sectionHeading: { marginBottom: 18, marginTop: 26 }, title: { color: colors.ink, fontSize: 34, fontWeight: "900", letterSpacing: -1, marginTop: 7 }, progress: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 17 }, progressDot: { alignItems: "center", backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 12, borderWidth: 1, height: 29, justifyContent: "center", width: 29 }, progressActive: { backgroundColor: colors.accent }, progressDone: { backgroundColor: "rgba(72, 229, 232, 0.16)", borderColor: colors.success }, progressText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  questionPanel: { backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 16, borderWidth: 1, padding: 17 }, questionTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, gold: { color: "#FFD166", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, timer: { color: colors.success, fontSize: 15, fontWeight: "900" }, question: { color: colors.ink, fontSize: 20, fontWeight: "900", lineHeight: 27, marginBottom: 12, marginTop: 15 }, option: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.outline, borderRadius: 11, borderWidth: 1, flexDirection: "row", marginTop: 7, minHeight: 50, paddingHorizontal: 10 }, optionCorrect: { backgroundColor: "rgba(72, 229, 232, 0.14)", borderColor: colors.success }, optionKey: { backgroundColor: colors.surfaceStrong, borderRadius: 7, color: colors.ink, fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 6 }, optionText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700", marginLeft: 10 }, empty: { backgroundColor: colors.backgroundRaised, borderRadius: 16, padding: 18 }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
});
