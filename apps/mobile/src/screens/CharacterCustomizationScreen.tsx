import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CharacterPreview } from "../components/CharacterPreview";
import { colors } from "../components/theme";
import {
  characterCatalog,
  characterColors,
  getCharacter,
  getCharacterColor,
} from "../features/characters/characterCatalog";
import type { CharacterSelection } from "@codexwars/shared";

type CharacterCustomizationScreenProps = {
  onBack: () => void;
  onNext: (selection: CharacterSelection) => void;
  selection: CharacterSelection;
  onSelectionChange: (selection: CharacterSelection) => void;
};

export function CharacterCustomizationScreen({
  onBack,
  onNext,
  selection,
  onSelectionChange,
}: CharacterCustomizationScreenProps) {
  const character = getCharacter(selection.characterId);
  const characterColor = getCharacterColor(selection.colorId);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to home"
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
        <Text style={styles.stepText}>1 of 2</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text accessibilityRole="header" style={styles.title}>Choose your contender</Text>
            <Text style={styles.subtitle}>Your choice is shared with every player before battle.</Text>
          </View>
          <View style={styles.previewWrap}>
            <CharacterPreview
              characterId={selection.characterId}
              colorId={selection.colorId}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Character</Text>
        <View accessibilityRole="radiogroup" style={styles.characterRow}>
          {characterCatalog.map((item) => {
            const selected = item.id === selection.characterId;
            return (
              <Pressable
                accessibilityLabel={`${item.displayName}, ${item.role}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={item.id}
                onPress={() => onSelectionChange({ ...selection, characterId: item.id })}
                style={({ pressed }) => [
                  styles.characterOption,
                  selected && styles.characterOptionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <CharacterPreview characterId={item.id} colorId={selection.colorId} compact />
                <Text style={styles.characterName}>{item.displayName}</Text>
                <Text style={styles.characterRole}>{item.role}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Battle color</Text>
        <View accessibilityRole="radiogroup" style={styles.colorRow}>
          {characterColors.map((item) => {
            const selected = item.id === selection.colorId;
            return (
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={item.id}
                onPress={() => onSelectionChange({ ...selection, colorId: item.id })}
                style={({ pressed }) => [
                  styles.colorButton,
                  selected && styles.colorButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.colorSwatch, { backgroundColor: item.value }]} />
                {selected && <Text style={styles.colorCheck}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.selectionSummary}>
          {character.displayName} · {characterColor.label}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerHint}>You can change this until the organizer starts.</Text>
        <Pressable
          accessibilityHint="Opens AR placement"
          accessibilityRole="button"
          onPress={() => onNext(selection)}
          style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
        >
          <Text style={styles.nextText}>Next: place character</Text>
          <Text style={styles.nextArrow}>→</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 64, paddingHorizontal: 18 },
  backButton: { alignItems: "center", height: 48, justifyContent: "center", width: 48 },
  backText: { color: colors.ink, fontSize: 36, lineHeight: 38 },
  progressTrack: { backgroundColor: colors.surfaceStrong, borderRadius: 4, flex: 1, height: 6, overflow: "hidden" },
  progressFill: { backgroundColor: colors.accent, height: 6, width: "50%" },
  stepText: { color: colors.inkMuted, fontSize: 12, fontWeight: "800" },
  content: { paddingBottom: 24, paddingHorizontal: 20 },
  titleRow: { minHeight: 245, position: "relative" },
  titleCopy: { maxWidth: "58%", paddingTop: 24, zIndex: 1 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900", letterSpacing: -1, lineHeight: 37 },
  subtitle: { color: colors.inkMuted, fontSize: 15, lineHeight: 21, marginTop: 12 },
  previewWrap: { bottom: 4, position: "absolute", right: -8 },
  sectionLabel: { color: colors.ink, fontSize: 16, fontWeight: "800", marginBottom: 11, marginTop: 12 },
  characterRow: { flexDirection: "row", gap: 9 },
  characterOption: {
    alignItems: "center",
    backgroundColor: colors.backgroundRaised,
    borderColor: "transparent",
    borderRadius: 14,
    borderWidth: 2,
    flex: 1,
    minHeight: 160,
    paddingBottom: 12,
    paddingHorizontal: 5,
  },
  characterOptionSelected: { borderColor: colors.accent, backgroundColor: colors.surface },
  characterName: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 2 },
  characterRole: { color: colors.inkSubtle, fontSize: 11, marginTop: 2 },
  colorRow: { flexDirection: "row", gap: 12 },
  colorButton: {
    alignItems: "center",
    borderColor: colors.outline,
    borderRadius: 999,
    borderWidth: 2,
    height: 52,
    justifyContent: "center",
    position: "relative",
    width: 52,
  },
  colorButtonSelected: { borderColor: colors.ink },
  colorSwatch: { borderRadius: 18, height: 36, width: 36 },
  colorCheck: { color: colors.background, fontSize: 17, fontWeight: "900", position: "absolute" },
  selectionSummary: { color: colors.inkMuted, fontSize: 13, marginTop: 10 },
  footer: { backgroundColor: colors.backgroundRaised, paddingBottom: 12, paddingHorizontal: 20, paddingTop: 12 },
  footerHint: { color: colors.inkSubtle, fontSize: 12, marginBottom: 9, textAlign: "center" },
  nextButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 18,
  },
  nextText: { color: colors.accentInk, fontSize: 16, fontWeight: "900" },
  nextArrow: { color: colors.accentInk, fontSize: 24, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
