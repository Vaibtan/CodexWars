import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../components/theme";

type HomeStep = "welcome" | "participant" | "organizer";

type HomeScreenProps = {
  busy: boolean;
  error: string | null;
  onCreateRoom: (nickname: string) => Promise<void>;
  onJoinRoom: (roomCode: string, nickname: string) => Promise<void>;
  onShowDemo: () => void;
  onTestAr: () => void;
};

export function HomeScreen({ busy, error, onCreateRoom, onJoinRoom, onShowDemo, onTestAr }: HomeScreenProps) {
  const [step, setStep] = useState<HomeStep>("welcome");
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Brand />
          {step === "welcome" ? (
            <View style={styles.welcome}>
              <View style={styles.orbit}>
                <View style={styles.orbitCore}><Text style={styles.orbitIcon}>✦</Text></View>
              </View>
              <Text style={styles.kicker}>KNOWLEDGE BECOMES POWER</Text>
              <Text accessibilityRole="header" style={styles.hero}>Turn learning{"\n"}into <Text style={styles.accent}>battle.</Text></Text>
              <Text style={styles.copy}>Earn powers through knowledge, meet classmates in the arena, and make every answer count.</Text>
              <ActionButton label="Join as participant" onPress={() => setStep("participant")} />
              <ActionButton label="Join as organizer" onPress={() => setStep("organizer")} secondary />
              <Pressable accessibilityRole="button" onPress={onShowDemo} style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}>
                <View style={styles.demoIcon}><Text style={styles.demoIconText}>▶</Text></View>
                <View style={styles.demoCopy}><Text style={styles.demoTitle}>Watch the CodexWars demo</Text><Text style={styles.demoMeta}>10 quick stories · about 1 minute</Text></View>
                <Text style={styles.demoArrow}>›</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onTestAr} style={styles.testButton}>
                <Text style={styles.testButtonText}>Test AR character placement</Text><Text style={styles.testIcon}>◎</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Pressable accessibilityRole="button" onPress={() => setStep("welcome")} style={styles.backButton}>
                <Text style={styles.backText}>‹  Back</Text>
              </Pressable>
              <Text style={styles.kicker}>{step === "participant" ? "PLAYER ACCESS" : "ORGANIZER ACCESS"}</Text>
              <Text accessibilityRole="header" style={styles.title}>
                {step === "participant" ? "Enter the arena." : "Create your War Room."}
              </Text>
              <Text style={styles.copyLeft}>
                {step === "participant"
                  ? "Use the six-digit code shared by your organizer. Your name will appear in the live lobby."
                  : "Choose the name participants will see, then share the generated room code."}
              </Text>
              <Field editable={!busy} label={step === "participant" ? "YOUR NAME" : "ORGANIZER NAME"} maxLength={32} onChangeText={setNickname} placeholder="Enter your name" value={nickname} />
              {step === "participant" ? (
                <Field editable={!busy} keyboardType="number-pad" label="ROOM CODE" maxLength={6} onChangeText={(value) => setRoomCode(value.replace(/\D/g, ""))} placeholder="482913" value={roomCode} />
              ) : null}
              {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
              <ActionButton
                disabled={busy || !nickname.trim() || (step === "participant" && roomCode.length !== 6)}
                label={busy ? "Connecting…" : step === "participant" ? "Join War Room  →" : "Create War Room  →"}
                onPress={() => step === "participant" ? void onJoinRoom(roomCode, nickname) : void onCreateRoom(nickname)}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Brand() {
  return <View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View><Text style={styles.brandText}>CODEX<Text style={styles.accent}>WARS</Text></Text></View>;
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...inputProps} autoCapitalize="words" placeholderTextColor="#77727F" style={styles.input} /></View>;
}

function ActionButton({ disabled, label, onPress, secondary }: { disabled?: boolean; label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, secondary && styles.actionSecondary, disabled && styles.disabled, pressed && styles.pressed]}><Text style={[styles.actionText, secondary && styles.actionSecondaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 28, paddingHorizontal: 22 },
  brand: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 64 },
  brandMark: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, height: 34, justifyContent: "center", width: 34 },
  brandMarkText: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  brandText: { color: colors.ink, fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  accent: { color: colors.accent },
  welcome: { flex: 1, justifyContent: "center", paddingBottom: 26 },
  orbit: { alignItems: "center", alignSelf: "center", borderColor: "rgba(149, 97, 255, 0.3)", borderRadius: 70, borderWidth: 1, height: 140, justifyContent: "center", marginBottom: 30, width: 140 },
  orbitCore: { alignItems: "center", backgroundColor: colors.surfaceStrong, borderColor: colors.accent, borderRadius: 43, borderWidth: 1, height: 86, justifyContent: "center", width: 86 },
  orbitIcon: { color: colors.success, fontSize: 36 },
  kicker: { color: colors.success, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  hero: { color: colors.ink, fontSize: 46, fontWeight: "900", letterSpacing: -1.7, lineHeight: 50, marginTop: 12 },
  copy: { color: colors.inkMuted, fontSize: 16, lineHeight: 24, marginBottom: 22, marginTop: 16 },
  copyLeft: { color: colors.inkMuted, fontSize: 15, lineHeight: 22, marginBottom: 12, marginTop: 12 },
  action: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 13, justifyContent: "center", marginTop: 12, minHeight: 56, paddingHorizontal: 16 },
  actionSecondary: { backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderWidth: 1 },
  actionText: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  actionSecondaryText: { color: colors.ink },
  demoButton: { alignItems: "center", backgroundColor: colors.surfaceStrong, borderRadius: 14, flexDirection: "row", marginTop: 14, minHeight: 64, paddingHorizontal: 12 },
  demoIcon: { alignItems: "center", backgroundColor: colors.success, borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  demoIconText: { color: colors.background, fontSize: 13, fontWeight: "900", marginLeft: 2 },
  demoCopy: { flex: 1, marginLeft: 11 },
  demoTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  demoMeta: { color: colors.inkMuted, fontSize: 11, marginTop: 3 },
  demoArrow: { color: colors.success, fontSize: 28, marginLeft: 8 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  testButton: { alignItems: "center", flexDirection: "row", justifyContent: "center", minHeight: 52, paddingTop: 10 },
  testButtonText: { color: colors.inkMuted, fontSize: 14, fontWeight: "700" },
  testIcon: { color: colors.success, fontSize: 20, marginLeft: 9 },
  form: { flex: 1, justifyContent: "center", paddingBottom: 40 },
  backButton: { alignSelf: "flex-start", justifyContent: "center", marginBottom: 30, minHeight: 48, paddingRight: 20 },
  backText: { color: colors.inkMuted, fontSize: 15, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 37, fontWeight: "900", letterSpacing: -1.1, lineHeight: 42, marginTop: 10 },
  field: { marginTop: 15 },
  fieldLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 7 },
  input: { backgroundColor: colors.backgroundRaised, borderColor: colors.outline, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 17, minHeight: 56, paddingHorizontal: 15 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18, marginTop: 12 },
});
