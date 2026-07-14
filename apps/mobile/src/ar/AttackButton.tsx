import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../components/theme";
import type { AttackId } from "./types";

type AttackButtonProps = {
  accent: string;
  detail: string;
  id: AttackId;
  label: string;
  onPress: (id: AttackId) => void;
};

export function AttackButton({ accent, detail, id, label, onPress }: AttackButtonProps) {
  return (
    <Pressable
      accessibilityHint={`Activates ${label}`}
      accessibilityLabel={`${label}, ${detail}`}
      accessibilityRole="button"
      onPress={() => onPress(id)}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <View style={[styles.indicator, { backgroundColor: accent }]} />
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      <Text numberOfLines={1} style={styles.detail}>
        {detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
    minHeight: 68,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  buttonPressed: {
    backgroundColor: colors.surfaceStrong,
    transform: [{ scale: 0.97 }],
  },
  indicator: {
    borderRadius: 4,
    height: 8,
    marginBottom: 6,
    width: 22,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  detail: {
    color: colors.inkSubtle,
    fontSize: 10,
    marginTop: 2,
  },
});
