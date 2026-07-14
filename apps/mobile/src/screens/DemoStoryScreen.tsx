import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STORY_DURATION_MS = 6_000;

type DemoStory = {
  accent: string;
  background: string;
  body: string;
  detail: string;
  icon: string;
  label: string;
  title: string;
};

const stories: readonly DemoStory[] = [
  { accent: "#C8FF4D", background: "#321477", body: "A classroom quiz becomes a shared AR finale where every correct answer changes the battle.", detail: "Kahoot meets laser tag", icon: "CW", label: "THE IDEA", title: "Learn it. Lock it. Battle it." },
  { accent: "#7AF7E5", background: "#075F70", body: "The organizer creates a live session and shares one simple room code with the group.", detail: "No student accounts required", icon: "01", label: "HOST", title: "Create a War Room." },
  { accent: "#FFD7E8", background: "#A92562", body: "Participants enter a nickname, join the lobby, and mark themselves ready in real time.", detail: "Live roster · visible readiness", icon: "02", label: "JOIN", title: "Bring the squad together." },
  { accent: "#FFE08A", background: "#A84538", body: "Ten organizer-controlled questions turn correct answers into shield, damage, cooldown, and ability rewards.", detail: "Answer once · advance together", icon: "03", label: "QUIZ", title: "Knowledge becomes power." },
  { accent: "#94F5FF", background: "#17488E", body: "While the organizer maps the play area, participants choose a character and color without entering AR too early.", detail: "Camera-safe setup", icon: "04", label: "SCAN", title: "Prepare the arena." },
  { accent: "#A9FFCB", background: "#17674F", body: "Each player joins the mapped arena, locks a safe standing position, and waits for the organizer.", detail: "Feet planted · rotate only", icon: "05", label: "READY", title: "Pick your spot. Lock in." },
  { accent: "#FFB4CB", background: "#3A246E", body: "Aim through the camera, fire fantasy attacks, absorb damage with shield, and survive when HP reaches zero.", detail: "Realtime HP · shield-first damage", icon: "06", label: "BATTLE", title: "Point. Fire. Survive." },
  { accent: "#C8FF4D", background: "#7A381D", body: "The organizer sees locked players, controls battle start, and follows every action through the shared event log.", detail: "One authoritative room state", icon: "07", label: "CONTROL", title: "One host sees it all." },
  { accent: "#FFF0A6", background: "#67358D", body: "Every device lands on the same final ranking, while the winner gets a dedicated victory moment.", detail: "Winner · standings · replay", icon: "08", label: "RESULTS", title: "Crown a champion." },
  { accent: "#8FFFE8", background: "#123E51", body: "Create, quiz, scan, position, battle, and celebrate—a complete five-minute hackathon demo.", detail: "Ready to enter CodexWars?", icon: "✓", label: "COMPLETE", title: "From question to champion." },
] as const;

export function DemoStoryScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const story = stories[index];

  const move = (delta: number) => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= stories.length) {
      onDone();
      return;
    }
    setIndex(next);
  };

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      duration: reduceMotion ? STORY_DURATION_MS + 2_000 : STORY_DURATION_MS,
      toValue: 1,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) move(1);
    });
    return () => animation.stop();
  }, [index, progress, reduceMotion]);

  return (
    <View style={[styles.screen, { backgroundColor: story.background }]}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <View accessibilityLabel={`Demo story ${index + 1} of ${stories.length}`} style={styles.progressRow}>
          {stories.map((item, itemIndex) => (
            <View key={item.label} style={styles.progressTrack}>
              {itemIndex < index ? <View style={styles.progressComplete} /> : null}
              {itemIndex === index ? <Animated.View style={[styles.progressComplete, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} /> : null}
            </View>
          ))}
        </View>
        <View style={styles.topBar}>
          <Text style={styles.brand}>CODEX<Text style={{ color: story.accent }}>WARS</Text></Text>
          <Pressable accessibilityLabel="Close demo" accessibilityRole="button" hitSlop={8} onPress={onDone} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Text style={styles.closeText}>×</Text></Pressable>
        </View>
        <Pressable
          accessibilityActions={[{ name: "increment", label: "Next story" }, { name: "decrement", label: "Previous story" }]}
          accessibilityHint="Tap the left side for the previous story or the right side for the next story"
          accessibilityLabel={`${story.title} ${story.body}`}
          accessibilityRole="adjustable"
          onAccessibilityAction={(event) => move(event.nativeEvent.actionName === "decrement" ? -1 : 1)}
          onPress={(event) => move(event.nativeEvent.locationX < width * 0.34 ? -1 : 1)}
          style={styles.story}
        >
          <View style={[styles.symbol, { borderColor: story.accent }]}><Text style={[styles.symbolText, { color: story.accent }]}>{story.icon}</Text></View>
          <View style={styles.copyBlock}>
            <Text style={[styles.label, { color: story.accent }]}>{story.label} · {String(index + 1).padStart(2, "0")}/{stories.length}</Text>
            <Text accessibilityRole="header" style={styles.title}>{story.title}</Text>
            <Text style={styles.body}>{story.body}</Text>
            <View style={styles.detail}><View style={[styles.detailDot, { backgroundColor: story.accent }]} /><Text style={styles.detailText}>{story.detail}</Text></View>
          </View>
          <Text style={styles.tapHint}>{index === stories.length - 1 ? "Tap to enter CodexWars" : "Tap right to continue"}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 16 },
  progressRow: { flexDirection: "row", gap: 4, paddingTop: 8 },
  progressTrack: { backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2, flex: 1, height: 3, overflow: "hidden" },
  progressComplete: { backgroundColor: "#FFFFFF", height: "100%", width: "100%" },
  topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 58 },
  brand: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  close: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  closeText: { color: "#FFFFFF", fontSize: 32, fontWeight: "400", lineHeight: 34 },
  story: { flex: 1, justifyContent: "center", paddingBottom: 22, paddingHorizontal: 8 },
  symbol: { alignItems: "center", alignSelf: "flex-start", borderRadius: 16, borderWidth: 2, height: 72, justifyContent: "center", marginBottom: 28, width: 72 },
  symbolText: { fontSize: 25, fontWeight: "900" },
  copyBlock: { maxWidth: 560 },
  label: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: "#FFFFFF", fontSize: 44, fontWeight: "900", letterSpacing: -1.4, lineHeight: 48, marginTop: 12 },
  body: { color: "rgba(255,255,255,0.88)", fontSize: 17, lineHeight: 25, marginTop: 18 },
  detail: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 12, flexDirection: "row", marginTop: 24, minHeight: 48, paddingHorizontal: 14 },
  detailDot: { borderRadius: 5, height: 10, marginRight: 10, width: 10 },
  detailText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  tapHint: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "700", marginTop: 42, textAlign: "center" },
  pressed: { opacity: 0.72 },
});
