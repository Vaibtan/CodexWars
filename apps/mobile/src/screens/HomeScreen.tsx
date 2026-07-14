import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../components/theme";
import { APP_NAME, APP_TAGLINE } from "../config/app";
import { isFirebaseConfigured } from "../lib/firebase/client";

type HomeScreenProps = {
  busy: boolean;
  error: string | null;
  onCreateRoom: (nickname: string) => Promise<void>;
  onJoinRoom: (roomCode: string, nickname: string) => Promise<void>;
  onTestAr: () => void;
};

export function HomeScreen({ busy, error, onCreateRoom, onJoinRoom, onTestAr }: HomeScreenProps) {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>{APP_NAME}</Text>
        <View style={styles.buildBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.buildBadgeText}>DEMO BUILD</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.title}>
          Turn the room into an arena.
        </Text>
        <Text style={styles.tagline}>{APP_TAGLINE}</Text>
        <Text style={styles.detail}>
          Create or join a synchronized War Room. Quiz results, character readiness,
          battle damage, and the action log flow through Firebase Realtime Database.
        </Text>
      </View>

      <View style={styles.demoSection}>
        <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
        <TextInput
          autoCapitalize="words"
          editable={!busy}
          maxLength={32}
          onChangeText={setNickname}
          placeholder="Your name"
          placeholderTextColor={colors.inkSubtle}
          style={styles.input}
          value={nickname}
        />
        <Text style={styles.fieldLabel}>ROOM CODE</Text>
        <TextInput
          editable={!busy}
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => setRoomCode(value.replace(/\D/g, ""))}
          placeholder="6 digits"
          placeholderTextColor={colors.inkSubtle}
          style={styles.input}
          value={roomCode}
        />

        <Pressable
          accessibilityHint="Joins an existing War Room as a participant"
          accessibilityRole="button"
          disabled={busy || roomCode.length !== 6}
          onPress={() => void onJoinRoom(roomCode, nickname)}
          style={({ pressed }) => [styles.primaryButton, (busy || roomCode.length !== 6) && styles.buttonDisabled, pressed && styles.primaryButtonPressed]}
        >
          <Text style={styles.primaryButtonText}>{busy ? "Connecting…" : "Join War Room"}</Text>
          <Text style={styles.primaryButtonArrow}>→</Text>
        </Pressable>
        <Pressable
          accessibilityHint="Creates a synchronized War Room as organizer"
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void onCreateRoom(nickname)}
          style={({ pressed }) => [styles.organizerButton, pressed && styles.primaryButtonPressed]}
        >
          <Text style={styles.organizerButtonText}>Create War Room</Text>
        </Pressable>
        <Pressable
          accessibilityHint="Opens a standalone camera scene for placing a 3D character"
          accessibilityRole="button"
          disabled={busy}
          onPress={onTestAr}
          style={({ pressed }) => [styles.arTestButton, pressed && styles.primaryButtonPressed]}
        >
          <Text style={styles.arTestButtonText}>Test AR · Place character</Text>
          <Text style={styles.arTestButtonIcon}>◎</Text>
        </Pressable>
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
      </View>

      <Text style={styles.firebaseState}>
        Firebase Realtime Database · {isFirebaseConfigured() ? "configured" : "setup pending"}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 64,
  },
  wordmark: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  buildBadge: {
    alignItems: "center",
    borderColor: colors.outline,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  liveDot: {
    backgroundColor: colors.success,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  buildBadgeText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 560,
    paddingBottom: 28,
    paddingTop: 24,
  },
  title: {
    color: colors.ink,
    fontSize: 46,
    fontWeight: "800",
    letterSpacing: -1.5,
    lineHeight: 49,
  },
  tagline: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  detail: {
    color: colors.inkMuted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    maxWidth: 430,
  },
  demoSection: {
    backgroundColor: colors.backgroundRaised,
    borderRadius: 16,
    padding: 18,
  },
  fieldLabel: { color: colors.inkSubtle, fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.surface, borderColor: colors.outline, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 50, paddingHorizontal: 14 },
  buttonDisabled: { opacity: 0.45 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 10, textAlign: "center" },
  stepRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  stepNumber: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  stepNumberText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  stepCopy: {
    flex: 1,
  },
  stepTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  stepDetail: {
    color: colors.inkSubtle,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  stepDivider: {
    backgroundColor: colors.outline,
    height: 1,
    marginVertical: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    minHeight: 56,
    paddingHorizontal: 18,
  },
  primaryButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: colors.accentInk,
    fontSize: 17,
    fontWeight: "800",
  },
  primaryButtonArrow: {
    color: colors.accentInk,
    fontSize: 24,
    fontWeight: "700",
  },
  organizerButton: {
    alignItems: "center",
    borderColor: colors.outline,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 52,
  },
  organizerButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  arTestButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  arTestButtonText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  arTestButtonIcon: { color: colors.accent, fontSize: 22, fontWeight: "900" },
  firebaseState: {
    color: colors.inkSubtle,
    fontSize: 12,
    marginBottom: 8,
    marginTop: 14,
    textAlign: "center",
  },
});
