import { Pressable, StyleSheet, Text, View } from "react-native";
import type { WeaponId } from "@codexwars/shared";
import { colors } from "../components/theme";

type AttackButtonProps = {
  accent: string;
  detail: string;
  disabled?: boolean;
  id: WeaponId;
  label: string;
  onPress: (id: WeaponId) => void;
};

export function AttackButton({ accent, detail, disabled = false, id, label, onPress }: AttackButtonProps) {
  return (
    <Pressable
      accessibilityHint={`Activates ${label}`}
      accessibilityLabel={`${label}, ${detail}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onPress(id)}
      style={({ pressed }) => [styles.button, disabled && styles.buttonDisabled, pressed && styles.buttonPressed]}
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
  buttonDisabled: { opacity: 0.48 },
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
