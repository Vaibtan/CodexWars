import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type PlayerStep =
  | "welcome"
  | "profile"
  | "join"
  | "waiting"
  | "quiz"
  | "results"
  | "powers"
  | "battle"
  | "complete";

type QuizQuestion = {
  topic: string;
  question: string;
  options: string[];
  answer: number;
};

const quizQuestions: QuizQuestion[] = [
  {
    topic: "VARIABLES",
    question: "Which keyword creates a block-scoped variable that can be reassigned?",
    options: ["var", "let", "const", "static"],
    answer: 1,
  },
  {
    topic: "ARRAYS",
    question: "Which array method adds an item to the end of an array?",
    options: ["shift()", "push()", "pop()", "slice()"],
    answer: 1,
  },
  {
    topic: "FUNCTIONS",
    question: "What does a JavaScript function return when it has no return statement?",
    options: ["null", "false", "undefined", "0"],
    answer: 2,
  },
  {
    topic: "LOOPS",
    question: "Which loop is best for reading each value in an array?",
    options: ["for...of", "while...of", "loopEach", "repeat"],
    answer: 0,
  },
  {
    topic: "OBJECTS",
    question: "How do you read the name property from a player object?",
    options: ["player->name", "player.name", "player[name()]", "name.player"],
    answer: 1,
  },
  {
    topic: "ALGORITHMS",
    question: "What is the typical time complexity of binary search?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
    answer: 1,
  },
  {
    topic: "DEBUGGING",
    question: "Which tool is most useful for inspecting a value while debugging JavaScript?",
    options: ["console.log()", "alertStyle()", "debugValue()", "showVariable()"],
    answer: 0,
  },
];

const leaderboard = [
  { name: "Aarav", score: 7 },
  { name: "You", score: 0 },
  { name: "Mira", score: 5 },
];

export function HomeScreen({
  onJoinAsOrganizer,
}: {
  onJoinAsOrganizer?: () => void;
}) {
  const [step, setStep] = useState<PlayerStep>("welcome");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [power, setPower] = useState("Shield");

  const startQuiz = () => {
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setStep("quiz");
  };

  const advanceProfile = () => {
    if (!name.trim()) {
      setError("Enter your name to continue.");
      return;
    }
    setError("");
    setStep("join");
  };

  const joinSession = () => {
    if (code.trim().length < 6) {
      setError("Enter the 6-digit code from your organizer.");
      return;
    }
    setError("");
    setStep("waiting");
  };

  const answerNextQuestion = () => {
    const current = quizQuestions[questionIndex];
    if (selectedAnswer === current.answer) {
      setScore((currentScore) => currentScore + 1);
    }

    if (questionIndex === quizQuestions.length - 1) {
      setSelectedAnswer(null);
      setStep("results");
      return;
    }

    setQuestionIndex((index) => index + 1);
    setSelectedAnswer(null);
  };

  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: topInset }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.screen}>
            <Brand />
            {step === "welcome" && (
              <Welcome
                onJoinAsOrganizer={onJoinAsOrganizer}
                onJoinAsParticipant={() => setStep("profile")}
              />
            )}
            {step === "profile" && (
              <ProfileForm
                error={error}
                name={name}
                onBack={() => setStep("welcome")}
                onChange={setName}
                onContinue={advanceProfile}
              />
            )}
            {step === "join" && (
              <JoinForm
                code={code}
                error={error}
                name={name}
                onBack={() => setStep("profile")}
                onChange={setCode}
                onJoin={joinSession}
              />
            )}
            {step === "waiting" && (
              <Waiting
                code={code}
                name={name}
                onExit={() => setStep("welcome")}
                onSkip={startQuiz}
              />
            )}
            {step === "quiz" && (
              <Quiz
                name={name}
                questionIndex={questionIndex}
                selectedAnswer={selectedAnswer}
                onBack={() => setStep("waiting")}
                onNext={answerNextQuestion}
                onSelect={setSelectedAnswer}
              />
            )}
            {step === "results" && (
              <Results
                name={name}
                score={score}
                onChoosePower={() => setStep("powers")}
              />
            )}
            {step === "powers" && (
              <PowerSelection
                power={power}
                onBack={() => setStep("results")}
                onChoose={setPower}
                onEnterArena={() => setStep("battle")}
              />
            )}
            {step === "battle" && (
              <BattleArena
                name={name}
                power={power}
                onFinish={() => setStep("complete")}
              />
            )}
            {step === "complete" && (
              <Complete onReturn={() => setStep("welcome")} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>C</Text>
      </View>
      <Text style={styles.brandText}>
        CODEX<Text style={styles.brandAccent}>WARS</Text>
      </Text>
    </View>
  );
}

function Welcome({
  onJoinAsOrganizer,
  onJoinAsParticipant,
}: {
  onJoinAsOrganizer?: () => void;
  onJoinAsParticipant: () => void;
}) {
  return (
    <View style={styles.welcome}>
      <View style={styles.orbit}>
        <View style={styles.orbitCore}>
          <Text style={styles.orbitIcon}>*</Text>
        </View>
      </View>
      <Text style={styles.eyebrow}>KNOWLEDGE BECOMES POWER</Text>
      <Text style={styles.hero}>
        Turn learning{"\n"}into <Text style={styles.accent}>battle.</Text>
      </Text>
      <Text style={styles.copy}>
        Earn powers through knowledge, meet classmates in the arena, and make
        every answer count.
      </Text>
      <PrimaryButton label="Join as participant" onPress={onJoinAsParticipant} />
      <SecondaryButton
        label="Join as organizer"
        onPress={onJoinAsOrganizer ?? onJoinAsParticipant}
      />
    </View>
  );
}

function ProfileForm({
  name,
  error,
  onChange,
  onContinue,
  onBack,
}: {
  name: string;
  error: string;
  onChange: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.card}>
      <BackButton label="Back" onPress={onBack} />
      <Text style={styles.eyebrow}>PLAYER PROFILE</Text>
      <Text style={styles.title}>What should we call you?</Text>
      <Text style={styles.copyLeft}>
        Use your name so your organizer can recognize you in the arena.
      </Text>
      <Field
        label="FULL NAME"
        placeholder="Enter your name"
        value={name}
        onChangeText={onChange}
      />
      <Error text={error} />
      <PrimaryButton label="Continue" onPress={onContinue} />
    </View>
  );
}

function JoinForm({
  name,
  code,
  error,
  onChange,
  onJoin,
  onBack,
}: {
  name: string;
  code: string;
  error: string;
  onChange: (value: string) => void;
  onJoin: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.card}>
      <BackButton label="Back" onPress={onBack} />
      <Text style={styles.eyebrow}>MEETING ACCESS</Text>
      <Text style={styles.title}>Welcome, {name.trim() || "player"}.</Text>
      <Text style={styles.copyLeft}>
        Enter the 6-digit code shared by your organizer to request a place in
        the arena.
      </Text>
      <Field
        keyboardType="number-pad"
        label="JOIN CODE"
        maxLength={6}
        placeholder="482913"
        value={code}
        onChangeText={onChange}
      />
      <Error text={error} />
      <PrimaryButton label="Join meeting" onPress={onJoin} />
    </View>
  );
}

function Waiting({
  name,
  code,
  onExit,
  onSkip,
}: {
  name: string;
  code: string;
  onExit: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.waiting}>
      <View style={styles.statusOrb}>
        <Text style={styles.statusOrbText}>OK</Text>
      </View>
      <Text style={styles.eyebrow}>REQUEST SENT · {code}</Text>
      <Text style={styles.waitingTitle}>Waiting for{"\n"}Organizer Approval</Text>
      <Text style={styles.copy}>
        You are in, {name || "player"}. Your organizer will confirm your place
        in the arena. Keep this screen open.
      </Text>
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>
      <View style={styles.waitingMeta}>
        <Text style={styles.metaText}>Approval pending</Text>
        <Text style={styles.metaText}>AWAITING ORGANIZER</Text>
      </View>
      <Pressable style={styles.skipButton} onPress={onSkip}>
        <Text style={styles.skipButtonText}>DEV: Skip approval and start quiz</Text>
      </Pressable>
      <SecondaryButton label="Leave lobby" onPress={onExit} />
    </View>
  );
}

function Quiz({
  name,
  questionIndex,
  selectedAnswer,
  onBack,
  onSelect,
  onNext,
}: {
  name: string;
  questionIndex: number;
  selectedAnswer: number | null;
  onBack: () => void;
  onSelect: (index: number) => void;
  onNext: () => void;
}) {
  const current = quizQuestions[questionIndex];
  const finalQuestion = questionIndex === quizQuestions.length - 1;

  return (
    <View style={styles.quizStart}>
      <BackButton label="Back to waiting" onPress={onBack} />
      <Text style={styles.eyebrow}>QUIZ IS LIVE</Text>
      <Text style={styles.quizTitle}>Ready, {name || "player"}?</Text>
      <Text style={styles.copyLeft}>
        Choose one answer before continuing. Your organizer controls the
        official session.
      </Text>
      <View style={styles.questionProgress}>
        {quizQuestions.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index === questionIndex && styles.progressDotActive,
              index < questionIndex && styles.progressDotComplete,
            ]}
          >
            <Text style={styles.progressDotText}>{index + 1}</Text>
          </View>
        ))}
      </View>
      <View style={styles.quizCard}>
        <Text style={styles.quizLabel}>{current.topic}</Text>
        <Text style={styles.questionNumber}>
          QUESTION {String(questionIndex + 1).padStart(2, "0")} / 07
        </Text>
        <Text style={styles.quizQuestion}>{current.question}</Text>
        {current.options.map((option, index) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedAnswer === index }}
            style={({ pressed }) => [
              styles.option,
              selectedAnswer === index && styles.optionSelected,
              pressed && styles.optionPressed,
            ]}
            onPress={() => onSelect(index)}
          >
            <Text
              style={[
                styles.optionKey,
                selectedAnswer === index && styles.optionKeySelected,
              ]}
            >
              {"ABCD"[index]}
            </Text>
            <Text style={styles.optionText}>{option}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        disabled={selectedAnswer === null}
        style={({ pressed }) => [
          styles.nextButton,
          selectedAnswer === null && styles.nextButtonDisabled,
          pressed && selectedAnswer !== null && styles.pressed,
        ]}
        onPress={onNext}
      >
        <Text style={styles.primaryButtonText}>
          {finalQuestion ? "Finish quiz" : "Next question"} →
        </Text>
      </Pressable>
    </View>
  );
}

function Results({
  name,
  score,
  onChoosePower,
}: {
  name: string;
  score: number;
  onChoosePower: () => void;
}) {
  const accuracy = Math.round((score / quizQuestions.length) * 100);
  const rankedPlayers = leaderboard
    .map((player) => (player.name === "You" ? { ...player, name: name || "You", score } : player))
    .sort((a, b) => b.score - a.score);

  return (
    <View style={styles.flowScreen}>
      <Text style={styles.eyebrow}>QUIZ COMPLETE</Text>
      <Text style={styles.title}>Your results</Text>
      <Text style={styles.copyLeft}>
        Your quiz has been submitted. See how you placed before choosing a
        battle power.
      </Text>
      <View style={styles.scorePanel}>
        <Text style={styles.scoreValue}>{score}/7</Text>
        <Text style={styles.scoreCaption}>CORRECT ANSWERS · {accuracy}% ACCURACY</Text>
      </View>
      <Text style={styles.sectionLabel}>LIVE LEADERBOARD</Text>
      <View style={styles.listCard}>
        {rankedPlayers.map((player, index) => (
          <View key={player.name} style={styles.leaderRow}>
            <Text style={[styles.rank, index < 3 && styles.rankTop]}>{index + 1}</Text>
            <Text numberOfLines={1} style={styles.leaderName}>{player.name}</Text>
            <Text style={styles.leaderScore}>{player.score} pts</Text>
          </View>
        ))}
      </View>
      <PrimaryButton label="Choose battle power" onPress={onChoosePower} />
    </View>
  );
}

function PowerSelection({
  power,
  onChoose,
  onEnterArena,
  onBack,
}: {
  power: string;
  onChoose: (power: string) => void;
  onEnterArena: () => void;
  onBack: () => void;
}) {
  const powers = [
    { name: "Shield", detail: "Absorb one incoming hit." },
    { name: "Pulse", detail: "Reveal an opponent position." },
    { name: "Boost", detail: "Gain a short speed advantage." },
  ];

  return (
    <View style={styles.flowScreen}>
      <BackButton label="Back to results" onPress={onBack} />
      <Text style={styles.eyebrow}>BATTLE LOADOUT</Text>
      <Text style={styles.title}>Choose your power</Text>
      <Text style={styles.copyLeft}>
        Pick one power for the arena. You can change it before the battle
        starts.
      </Text>
      {powers.map((item) => (
        <Pressable
          key={item.name}
          style={({ pressed }) => [
            styles.powerCard,
            power === item.name && styles.powerCardSelected,
            pressed && styles.pressed,
          ]}
          onPress={() => onChoose(item.name)}
        >
          <View style={styles.powerIcon}>
            <Text style={styles.powerIconText}>{item.name.slice(0, 1)}</Text>
          </View>
          <View style={styles.powerCopy}>
            <Text style={styles.powerName}>{item.name}</Text>
            <Text style={styles.powerDetail}>{item.detail}</Text>
          </View>
          <View style={[styles.radio, power === item.name && styles.radioSelected]} />
        </Pressable>
      ))}
      <PrimaryButton label="Enter battle arena" onPress={onEnterArena} />
    </View>
  );
}

function BattleArena({
  name,
  power,
  onFinish,
}: {
  name: string;
  power: string;
  onFinish: () => void;
}) {
  return (
    <View style={styles.flowScreen}>
      <Text style={styles.eyebrow}>ROUND 01 · BATTLE LIVE</Text>
      <Text style={styles.title}>Battle arena</Text>
      <Text style={styles.copyLeft}>
        Your organizer has started the arena. Stay alert and use your power at
        the right moment.
      </Text>
      <View style={styles.arena}>
        <View style={styles.arenaGlow} />
        <Text style={styles.arenaStatus}>PLAYERS ALIVE · 12</Text>
        <Text style={styles.arenaName}>{name || "Player"}</Text>
        <View style={styles.healthTrack}>
          <View style={styles.healthFill} />
        </View>
        <View style={styles.arenaMeta}>
          <Text style={styles.arenaMetaText}>HEALTH 100</Text>
          <Text style={styles.arenaMetaText}>POWER {power.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.battleHint}>
        <Text style={styles.battleHintTitle}>Your loadout: {power}</Text>
        <Text style={styles.battleHintText}>
          Battle actions will arrive from the live organizer session.
        </Text>
      </View>
      <PrimaryButton label="Finish demo battle" onPress={onFinish} />
    </View>
  );
}

function Complete({ onReturn }: { onReturn: () => void }) {
  return (
    <View style={styles.complete}>
      <View style={styles.completeOrb}>
        <Text style={styles.completeOrbText}>GG</Text>
      </View>
      <Text style={styles.eyebrow}>SESSION COMPLETE</Text>
      <Text style={styles.waitingTitle}>Battle finished</Text>
      <Text style={styles.copy}>
        Great work. Your score and battle progress have been recorded for this
        demo session.
      </Text>
      <PrimaryButton label="Return to lobby" onPress={onReturn} />
    </View>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "number-pad";
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="words"
        keyboardType={keyboardType}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor="#777486"
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable hitSlop={10} onPress={onPress}>
      <Text style={styles.back}>← {label}</Text>
    </Pressable>
  );
}

function Error({ text }: { text: string }) {
  return text ? <Text style={styles.error}>{text}</Text> : <View style={styles.errorSpace} />;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label} →</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#090909", flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 42 },
  screen: { alignSelf: "center", flexGrow: 1, maxWidth: 480, paddingHorizontal: 24, paddingTop: 14, width: "100%" },
  brand: { alignItems: "center", flexDirection: "row", gap: 9 },
  brandMark: { alignItems: "center", backgroundColor: "#9561FF", borderRadius: 10, height: 33, justifyContent: "center", width: 33 },
  brandMarkText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  brandText: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 1.3 },
  brandAccent: { color: "#A979FF" },
  welcome: { alignItems: "center", flex: 1, justifyContent: "center", paddingTop: 30 },
  orbit: { alignItems: "center", borderColor: "#9561FF55", borderRadius: 104, borderWidth: 1, height: 208, justifyContent: "center", marginBottom: 30, width: 208 },
  orbitCore: { alignItems: "center", backgroundColor: "#9561FF2B", borderColor: "#A979FF", borderRadius: 58, borderWidth: 1, height: 116, justifyContent: "center", shadowColor: "#9561FF", shadowOpacity: 0.7, shadowRadius: 25, width: 116 },
  orbitIcon: { color: "#48E5E8", fontSize: 46, fontWeight: "800" },
  eyebrow: { color: "#48E5E8", fontSize: 10, fontWeight: "800", letterSpacing: 1.8, marginBottom: 13 },
  hero: { color: "#fff", fontSize: 42, fontWeight: "800", letterSpacing: -1.6, lineHeight: 46, textAlign: "center" },
  accent: { color: "#A979FF" },
  copy: { color: "#AAA7B6", fontSize: 15, lineHeight: 23, marginBottom: 26, marginTop: 16, textAlign: "center" },
  copyLeft: { color: "#AAA7B6", fontSize: 15, lineHeight: 23, marginBottom: 26, marginTop: 12 },
  card: { backgroundColor: "#17151E", borderColor: "#FFFFFF1E", borderRadius: 22, borderWidth: 1, marginTop: 48, padding: 22 },
  back: { color: "#CBC7D3", fontSize: 14, fontWeight: "700", marginBottom: 30 },
  title: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.8, lineHeight: 36 },
  field: { marginTop: 8 },
  fieldLabel: { color: "#9B96A7", fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 9 },
  input: { backgroundColor: "#0D0C11", borderColor: "#FFFFFF22", borderRadius: 13, borderWidth: 1, color: "#fff", fontSize: 17, minHeight: 54, paddingHorizontal: 16 },
  error: { color: "#FF8C9B", fontSize: 12, marginTop: 8 },
  errorSpace: { height: 20 },
  primaryButton: { alignItems: "center", backgroundColor: "#8E58F5", borderRadius: 14, justifyContent: "center", minHeight: 54, width: "100%" },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondaryButton: { alignItems: "center", borderColor: "#FFFFFF26", borderRadius: 14, borderWidth: 1, justifyContent: "center", marginTop: 11, minHeight: 52, width: "100%" },
  secondaryButtonText: { color: "#DDD9E5", fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  waiting: { alignItems: "center", flex: 1, justifyContent: "center", paddingTop: 50 },
  statusOrb: { alignItems: "center", backgroundColor: "#48E5E81C", borderColor: "#48E5E8", borderRadius: 60, borderWidth: 1, height: 120, justifyContent: "center", marginBottom: 32, shadowColor: "#48E5E8", shadowOpacity: 0.45, shadowRadius: 28, width: 120 },
  statusOrbText: { color: "#48E5E8", fontSize: 22, fontWeight: "800" },
  waitingTitle: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -1, lineHeight: 39, textAlign: "center" },
  progressTrack: { backgroundColor: "#FFFFFF14", borderRadius: 8, height: 7, marginTop: 8, overflow: "hidden", width: "100%" },
  progressFill: { backgroundColor: "#48E5E8", borderRadius: 8, height: 7, width: "62%" },
  waitingMeta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 27, marginTop: 10, width: "100%" },
  metaText: { color: "#8F8B99", fontSize: 10, fontWeight: "700" },
  skipButton: { alignItems: "center", borderColor: "#48E5E855", borderRadius: 13, borderWidth: 1, justifyContent: "center", minHeight: 48, width: "100%" },
  skipButtonText: { color: "#48E5E8", fontSize: 13, fontWeight: "800" },
  quizStart: { flexGrow: 1, paddingTop: 30 },
  quizTitle: { color: "#fff", fontSize: 35, fontWeight: "800", letterSpacing: -1, lineHeight: 40 },
  questionProgress: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  progressDot: { alignItems: "center", backgroundColor: "#17151E", borderColor: "#FFFFFF1E", borderRadius: 12, borderWidth: 1, height: 24, justifyContent: "center", width: 24 },
  progressDotActive: { backgroundColor: "#9561FF", borderColor: "#A979FF" },
  progressDotComplete: { backgroundColor: "#48E5E82A", borderColor: "#48E5E8" },
  progressDotText: { color: "#E5E1EC", fontSize: 10, fontWeight: "800" },
  quizCard: { backgroundColor: "#17151E", borderColor: "#FFFFFF1E", borderRadius: 20, borderWidth: 1, padding: 19 },
  quizLabel: { color: "#F3C85B", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  questionNumber: { color: "#8F8B99", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 8 },
  quizQuestion: { color: "#fff", fontSize: 20, fontWeight: "800", lineHeight: 27, marginBottom: 18, marginTop: 13 },
  option: { alignItems: "center", backgroundColor: "#0E0D13", borderColor: "#FFFFFF18", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 8, minHeight: 53, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: "#9561FF24", borderColor: "#A979FF" },
  optionPressed: { opacity: 0.8 },
  optionKey: { backgroundColor: "#9561FF24", borderRadius: 8, color: "#B691FF", fontSize: 12, fontWeight: "800", height: 28, paddingTop: 6, textAlign: "center", width: 28 },
  optionKeySelected: { backgroundColor: "#9561FF", color: "#fff" },
  optionText: { color: "#E3DFE9", flex: 1, fontSize: 15, fontWeight: "700" },
  nextButton: { alignItems: "center", backgroundColor: "#8E58F5", borderRadius: 14, justifyContent: "center", marginTop: 16, minHeight: 54, width: "100%" },
  nextButtonDisabled: { opacity: 0.38 },
  flowScreen: { flexGrow: 1, paddingTop: 48 },
  scorePanel: { alignItems: "center", backgroundColor: "#17151E", borderColor: "#9561FF55", borderRadius: 22, borderWidth: 1, marginBottom: 25, paddingVertical: 26 },
  scoreValue: { color: "#48E5E8", fontSize: 48, fontWeight: "800", letterSpacing: -1.8 },
  scoreCaption: { color: "#AAA7B6", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 7 },
  sectionLabel: { color: "#9B96A7", fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 9 },
  listCard: { backgroundColor: "#17151E", borderColor: "#FFFFFF1E", borderRadius: 18, borderWidth: 1, marginBottom: 17, overflow: "hidden" },
  leaderRow: { alignItems: "center", borderBottomColor: "#FFFFFF12", borderBottomWidth: 1, flexDirection: "row", minHeight: 58, paddingHorizontal: 15 },
  rank: { color: "#AAA7B6", fontSize: 14, fontWeight: "800", width: 32 },
  rankTop: { color: "#F3C85B" },
  leaderName: { color: "#F0EDF4", flex: 1, fontSize: 15, fontWeight: "700" },
  leaderScore: { color: "#48E5E8", fontSize: 13, fontWeight: "800" },
  powerCard: { alignItems: "center", backgroundColor: "#17151E", borderColor: "#FFFFFF1E", borderRadius: 17, borderWidth: 1, flexDirection: "row", marginBottom: 11, minHeight: 84, padding: 14 },
  powerCardSelected: { backgroundColor: "#9561FF1C", borderColor: "#A979FF" },
  powerIcon: { alignItems: "center", backgroundColor: "#9561FF2B", borderRadius: 13, height: 48, justifyContent: "center", width: 48 },
  powerIconText: { color: "#C8A7FF", fontSize: 20, fontWeight: "800" },
  powerCopy: { flex: 1, marginLeft: 13 },
  powerName: { color: "#fff", fontSize: 16, fontWeight: "800" },
  powerDetail: { color: "#AAA7B6", fontSize: 12, lineHeight: 17, marginTop: 4 },
  radio: { borderColor: "#8F8B99", borderRadius: 10, borderWidth: 2, height: 20, width: 20 },
  radioSelected: { backgroundColor: "#48E5E8", borderColor: "#48E5E8" },
  arena: { alignItems: "center", backgroundColor: "#17151E", borderColor: "#48E5E855", borderRadius: 24, borderWidth: 1, marginBottom: 16, overflow: "hidden", padding: 26 },
  arenaGlow: { backgroundColor: "#48E5E81B", borderRadius: 90, height: 180, position: "absolute", top: -94, width: 180 },
  arenaStatus: { color: "#48E5E8", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  arenaName: { color: "#fff", fontSize: 30, fontWeight: "800", marginBottom: 25, marginTop: 28 },
  healthTrack: { backgroundColor: "#FFFFFF18", borderRadius: 8, height: 9, overflow: "hidden", width: "100%" },
  healthFill: { backgroundColor: "#48E5E8", height: 9, width: "100%" },
  arenaMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, width: "100%" },
  arenaMetaText: { color: "#AAA7B6", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  battleHint: { backgroundColor: "#9561FF18", borderRadius: 16, marginBottom: 17, padding: 16 },
  battleHintTitle: { color: "#E5D9FF", fontSize: 15, fontWeight: "800" },
  battleHintText: { color: "#B6ADCA", fontSize: 13, lineHeight: 19, marginTop: 5 },
  complete: { alignItems: "center", flex: 1, justifyContent: "center", paddingTop: 52 },
  completeOrb: { alignItems: "center", backgroundColor: "#9561FF2B", borderColor: "#A979FF", borderRadius: 60, borderWidth: 1, height: 120, justifyContent: "center", marginBottom: 32, width: 120 },
  completeOrbText: { color: "#C8A7FF", fontSize: 27, fontWeight: "900" },
});
