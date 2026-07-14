import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../components/theme";
import { APP_NAME, APP_TAGLINE } from "../config/app";
import { isFirebaseConfigured } from "../lib/firebase/client";

type HomeScreenProps = {
  onOpenArDemo: () => void;
};

export function HomeScreen({ onOpenArDemo }: HomeScreenProps) {
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
          Preview the organizer floor scan, then enter a battle scene with
          static opponents and working combat controls.
        </Text>
      </View>

      <View style={styles.demoSection}>
        <View style={styles.stepRow}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>Find the arena floor</Text>
            <Text style={styles.stepDetail}>Move slowly until a horizontal plane locks.</Text>
          </View>
        </View>
        <View style={styles.stepDivider} />
        <View style={styles.stepRow}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>Enter battle</Text>
            <Text style={styles.stepDetail}>Aim at three demo opponents and test attacks.</Text>
          </View>
        </View>

        <Pressable
          accessibilityHint="Opens the organizer floor scan"
          accessibilityRole="button"
          onPress={onOpenArDemo}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        >
          <Text style={styles.primaryButtonText}>Launch AR demo</Text>
          <Text style={styles.primaryButtonArrow}>→</Text>
        </Pressable>
      </View>

      <Text style={styles.firebaseState}>
        Firebase quiz storage · {isFirebaseConfigured() ? "configured" : "setup pending"}
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
  firebaseState: {
    color: colors.inkSubtle,
    fontSize: 12,
    marginBottom: 8,
    marginTop: 14,
    textAlign: "center",
  },
});
