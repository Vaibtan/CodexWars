import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { startingShieldForScore, type PublicRoomState } from "@codexwars/shared";
import { colors } from "../components/theme";
import type { WarRoomRealtimeClient } from "../features/warRoom/realtimeClient";

export function ParticipantQuizScreen({ client, onLeave, room }: { client: WarRoomRealtimeClient; onLeave: () => void; room: PublicRoomState }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const question = room.quiz.currentQuestion.id ? room.quiz.currentQuestion : null;
  const participant = client.session.playerId === null ? undefined : room.players[client.session.playerId];

  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
    setError(null);
  }, [room.quiz.currentQuestion.id]);
  useEffect(() => {
    if (participant?.hasAnsweredCurrent) setSubmitted(true);
  }, [participant?.hasAnsweredCurrent]);
  useEffect(() => { const interval = setInterval(() => setClock(Date.now()), 500); return () => clearInterval(interval); }, []);

  const submit = async () => {
    if (!question || !selected || submitted || room.quiz.status !== "question") return;
    setBusy(true); setError(null);
    try { await client.send({ optionId: selected, questionId: question.id, type: "quiz_answer" }); setSubmitted(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  };
  const estimatedServerNow = clock + (room.serverNow - Date.now());
  const seconds = Math.max(0, Math.ceil((room.quiz.questionEndsAt - estimatedServerNow) / 1_000));
  const revealed = room.quiz.status === "reveal";
  const answerLocked = submitted || revealed || room.quiz.status !== "question" || seconds === 0;
  const answeredCorrectly = revealed && selected !== null && selected === room.quiz.revealedCorrectOptionId;
  const currentScore = participant?.correctAnswers ?? 0;
  const scoredQuestions = Math.max(0, room.quiz.questionIndex + (revealed ? 1 : 0));

  return <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View><Text style={styles.brand}>CODEX<Text style={styles.purple}>WARS</Text></Text><Pressable accessibilityRole="button" onPress={onLeave} style={styles.leave}><Text style={styles.leaveText}>Leave</Text></Pressable></View>
      <View style={styles.quizHeader}><Text style={styles.kicker}>LIVE QUIZ · ROOM {room.roomId}</Text><Text style={styles.title}>{question ? `Question ${room.quiz.questionIndex + 1}` : "Quiz complete"}</Text><Text style={styles.progress}>{scoredQuestions} of {room.quiz.questionCount} scored</Text></View>
      {question ? <>
        <View style={styles.timer}><Text style={styles.timerValue}>{revealed ? "ANSWER" : `00:${String(seconds).padStart(2, "0")}`}</Text><Text style={styles.timerLabel}>{revealed ? "REVEALED" : "SECONDS LEFT"}</Text></View>
        <View style={styles.questionCard}><Text style={styles.topic}>{question.difficulty.toUpperCase()}</Text><Text style={styles.question}>{question.prompt}</Text>{question.options.map((option, index) => {
          const isSelected = selected === option.id;
          const isCorrect = revealed && option.id === room.quiz.revealedCorrectOptionId;
          const isWrong = revealed && isSelected && !isCorrect;
          return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: isSelected, disabled: answerLocked }} disabled={answerLocked} onPress={() => setSelected(option.id)} style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, isCorrect && styles.optionCorrect, isWrong && styles.optionWrong, pressed && styles.pressed]}><Text style={[styles.optionKey, (isSelected || isCorrect) && styles.optionKeyActive]}>{"ABCD"[index]}</Text><Text style={styles.optionText}>{option.label}</Text>{isCorrect ? <Text style={styles.correctMark}>✓</Text> : null}</Pressable>;
        })}</View>
        {revealed ? <View style={[styles.feedback, !answeredCorrectly && styles.feedbackWrong]}><Text style={[styles.feedbackTitle, !answeredCorrectly && styles.feedbackTitleWrong]}>{answeredCorrectly ? "Correct — quiz shield earned" : selected ? "Incorrect — score unchanged" : "No answer submitted"}</Text><Text style={styles.feedbackBody}>{room.quiz.revealedExplanation || `Current score: ${currentScore}/${room.quiz.questionCount}. Starting shield: ${startingShieldForScore(currentScore)}.`}</Text><Text style={styles.feedbackWait}>The next question opens automatically after this reveal.</Text></View> : <Pressable accessibilityRole="button" accessibilityState={{ disabled: !selected || answerLocked || busy }} disabled={!selected || answerLocked || busy} onPress={() => void submit()} style={[styles.submit, (!selected || answerLocked || busy) && styles.disabled]}><Text style={styles.submitText}>{submitted ? "Answer locked — waiting for reveal" : seconds === 0 ? "Time expired" : busy ? "Submitting…" : "Lock answer"}</Text></Pressable>}
      </> : <View style={styles.waiting}><View style={styles.waitingOrb}><Text style={styles.waitingOrbText}>✓</Text></View><Text style={styles.waitingTitle}>Quiz complete.</Text><Text style={styles.waitingBody}>Your result is synchronized. Continue to character selection.</Text></View>}
      {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 }, scroll: { flexGrow: 1, paddingBottom: 30, paddingHorizontal: 20 }, header: { alignItems: "center", flexDirection: "row", minHeight: 64 }, brandMark: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 9, height: 32, justifyContent: "center", width: 32 }, brandMarkText: { color: colors.ink, fontSize: 17, fontWeight: "900" }, brand: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900", letterSpacing: 1, marginLeft: 9 }, purple: { color: colors.accent }, leave: { borderColor: colors.outline, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 13 }, leaveText: { color: colors.inkMuted, fontSize: 12, fontWeight: "800" },
  quizHeader: { marginBottom: 18, marginTop: 22 }, kicker: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: colors.ink, fontSize: 34, fontWeight: "900", letterSpacing: -1, marginTop: 7 }, progress: { color: colors.inkMuted, fontSize: 13, marginTop: 6 }, timer: { alignItems: "center", alignSelf: "center", borderColor: colors.success, borderRadius: 70, borderWidth: 6, height: 136, justifyContent: "center", marginBottom: 20, width: 136 }, timerValue: { color: colors.ink, fontSize: 28, fontWeight: "900" }, timerLabel: { color: colors.inkMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 4 },
  questionCard: { backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 16, borderWidth: 1, padding: 16 }, topic: { color: "#FFD166", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, question: { color: colors.ink, fontSize: 20, fontWeight: "900", lineHeight: 27, marginBottom: 12, marginTop: 14 }, option: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.outline, borderRadius: 11, borderWidth: 1, flexDirection: "row", marginTop: 8, minHeight: 54, paddingHorizontal: 10 }, optionSelected: { backgroundColor: colors.surfaceStrong, borderColor: colors.accent }, optionCorrect: { backgroundColor: "rgba(72, 229, 232, 0.14)", borderColor: colors.success }, optionWrong: { backgroundColor: "rgba(255, 119, 134, 0.12)", borderColor: colors.danger }, optionKey: { backgroundColor: colors.backgroundRaised, borderRadius: 7, color: colors.inkMuted, fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 6 }, optionKeyActive: { backgroundColor: colors.accent, color: colors.ink }, optionText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700", marginLeft: 10 }, correctMark: { color: colors.success, fontSize: 18, fontWeight: "900" }, pressed: { opacity: 0.8 },
  submit: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 13, justifyContent: "center", marginTop: 16, minHeight: 56 }, submitText: { color: colors.ink, fontSize: 15, fontWeight: "900" }, disabled: { opacity: 0.45 }, feedback: { backgroundColor: "rgba(72, 229, 232, 0.1)", borderColor: colors.success, borderRadius: 13, borderWidth: 1, marginTop: 14, padding: 15 }, feedbackWrong: { backgroundColor: "rgba(255, 119, 134, 0.1)", borderColor: colors.danger }, feedbackTitle: { color: colors.success, fontSize: 15, fontWeight: "900" }, feedbackTitleWrong: { color: colors.danger }, feedbackBody: { color: colors.ink, fontSize: 13, fontWeight: "700", lineHeight: 20, marginTop: 7 }, feedbackWait: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  waiting: { alignItems: "center", flex: 1, justifyContent: "center", paddingVertical: 70 }, waitingOrb: { alignItems: "center", backgroundColor: colors.surfaceStrong, borderColor: colors.success, borderRadius: 42, borderWidth: 2, height: 84, justifyContent: "center", width: 84 }, waitingOrbText: { color: colors.success, fontSize: 30, fontWeight: "900" }, waitingTitle: { color: colors.ink, fontSize: 27, fontWeight: "900", marginTop: 20 }, waitingBody: { color: colors.inkMuted, fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: "center" }, error: { color: colors.danger, fontSize: 13, marginTop: 12, textAlign: "center" },
});
