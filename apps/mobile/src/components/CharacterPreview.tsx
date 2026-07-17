import { StyleSheet, Text, View } from "react-native";
import { colors } from "./theme";
import type { CharacterColorId, CharacterId } from "@codexwars/shared";
import { getCharacterColor } from "../features/characters/characterCatalog";

type CharacterPreviewProps = {
  characterId: CharacterId;
  colorId: CharacterColorId;
  compact?: boolean;
};

export function CharacterPreview({ characterId, colorId, compact = false }: CharacterPreviewProps) {
  const tint = getCharacterColor(colorId).value;
  const initial = characterId === "knight" ? "A" : characterId === "ninja" ? "K" : "R";

  return (
    <View accessibilityElementsHidden style={[styles.stage, compact && styles.stageCompact]}>
      <View style={[styles.glow, { backgroundColor: tint }]} />
      {characterId === "wizard" ? (
        <View style={[styles.wizardHat, { borderBottomColor: tint }]} />
      ) : characterId === "knight" ? (
        <View style={[styles.crest, { backgroundColor: tint }]} />
      ) : (
        <View style={[styles.headband, { backgroundColor: tint }]} />
      )}
      <View style={[styles.head, compact && styles.headCompact]}>
        <Text style={[styles.initial, compact && styles.initialCompact]}>{initial}</Text>
      </View>
      <View style={[styles.body, compact && styles.bodyCompact, { backgroundColor: tint }]}>
        <View style={styles.bodyInset} />
      </View>
      <View style={[styles.base, { backgroundColor: tint }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    height: 220,
    justifyContent: "flex-end",
    overflow: "hidden",
    position: "relative",
    width: 180,
  },
  stageCompact: { height: 104, width: 82 },
  glow: { borderRadius: 80, bottom: 18, height: 130, opacity: 0.16, position: "absolute", width: 130 },
  wizardHat: {
    borderBottomWidth: 46,
    borderLeftColor: "transparent",
    borderLeftWidth: 28,
    borderRightColor: "transparent",
    borderRightWidth: 28,
    height: 0,
    marginBottom: -9,
    width: 0,
  },
  crest: { borderRadius: 5, height: 32, marginBottom: -8, width: 13 },
  headband: { borderRadius: 4, height: 9, marginBottom: -4, width: 62 },
  head: {
    alignItems: "center",
    backgroundColor: "#FFD2B8",
    borderColor: colors.background,
    borderRadius: 31,
    borderWidth: 4,
    height: 62,
    justifyContent: "center",
    width: 62,
  },
  headCompact: { borderRadius: 20, borderWidth: 3, height: 40, width: 40 },
  initial: { color: colors.background, fontSize: 20, fontWeight: "900" },
  initialCompact: { fontSize: 14 },
  body: {
    alignItems: "center",
    borderColor: colors.background,
    borderRadius: 14,
    borderWidth: 4,
    height: 82,
    marginTop: -3,
    paddingTop: 13,
    width: 92,
  },
  bodyCompact: { borderRadius: 9, borderWidth: 3, height: 45, paddingTop: 7, width: 54 },
  bodyInset: { backgroundColor: colors.background, borderRadius: 4, height: 7, opacity: 0.6, width: "56%" },
  base: { borderRadius: 999, height: 8, marginTop: 10, opacity: 0.75, width: 118 },
});
