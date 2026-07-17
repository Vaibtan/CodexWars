import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PublicRoomState } from "@codexwars/shared";
import { CharacterPreview } from "../components/CharacterPreview";
import { colors } from "../components/theme";
import type { CharacterSelection } from "@codexwars/shared";

type BattleResultsScreenProps = {
  onDone: () => void;
  onRunAnotherRound?: () => void;
  role: "organizer" | "participant";
  room?: PublicRoomState | null;
  selection?: CharacterSelection;
};

const standings = [
  { hp: 72, name: "Mira", place: 1 },
  { hp: 41, name: "You", place: 2 },
  { hp: 0, name: "Theo", place: 3 },
];

export function BattleResultsScreen({ onDone, onRunAnotherRound, role, room, selection }: BattleResultsScreenProps) {
  const syncedStandings = room
    ? room.battle.standings.length > 0
      ? [...room.battle.standings]
        .sort((a, b) => a.rank - b.rank)
        .map((standing) => ({ hp: standing.hp, name: standing.displayName, place: standing.rank }))
      : Object.values(room.players)
        .map((player) => ({ hp: player.hp, name: player.displayName }))
        .sort((a, b) => b.hp - a.hp)
        .map((participant, index) => ({ ...participant, place: index + 1 }))
    : standings;
  const winner = syncedStandings[0]?.name ?? "No winner";
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.resultMark}><Text style={styles.resultMarkText}>✦</Text></View>
        <Text accessibilityRole="header" style={styles.title}>Battle complete</Text>
        <Text style={styles.subtitle}>{role === "organizer" ? `${winner} wins the arena` : `Winner · ${winner}`}</Text>
        <Text style={styles.detail}>Final standings are frozen from the authoritative Colyseus room state calculated by the game server.</Text>

        {selection ? (
          <View style={styles.characterWrap}>
            <CharacterPreview characterId={selection.characterId} colorId={selection.colorId} compact />
          </View>
        ) : null}

        <View style={styles.standings}>
          <Text style={styles.standingsTitle}>Final standings</Text>
          {syncedStandings.map((player) => (
            <View key={player.name} style={styles.playerRow}>
              <Text style={styles.place}>{player.place}</Text>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.playerHp}>{player.hp} HP</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {role === "organizer" && onRunAnotherRound ? (
          <Pressable accessibilityRole="button" onPress={onRunAnotherRound} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Run another round</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onDone} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryButtonText}>{role === "organizer" ? "Return home" : "Done"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { alignItems: "center", paddingBottom: 24, paddingHorizontal: 22, paddingTop: 44 },
  resultMark: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 999, height: 64, justifyContent: "center", width: 64 },
  resultMarkText: { color: colors.accentInk, fontSize: 30, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 38, fontWeight: "900", letterSpacing: -1, marginTop: 20, textAlign: "center" },
  subtitle: { color: colors.accent, fontSize: 22, fontWeight: "900", marginTop: 8, textAlign: "center" },
  detail: { color: colors.inkMuted, fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 500, textAlign: "center" },
  characterWrap: { height: 102, marginTop: 12, overflow: "hidden" },
  standings: { alignSelf: "stretch", backgroundColor: colors.backgroundRaised, borderRadius: 16, marginTop: 24, padding: 16 },
  standingsTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 6 },
  playerRow: { alignItems: "center", borderBottomColor: colors.outline, borderBottomWidth: 1, flexDirection: "row", minHeight: 56 },
  place: { color: colors.accent, fontSize: 18, fontWeight: "900", width: 36 },
  playerName: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: "800" },
  playerHp: { color: colors.inkMuted, fontSize: 13, fontWeight: "700" },
  footer: { backgroundColor: colors.backgroundRaised, gap: 10, paddingBottom: 12, paddingHorizontal: 22, paddingTop: 12 },
  primaryButton: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 14, justifyContent: "center", minHeight: 56 },
  primaryButtonText: { color: colors.accentInk, fontSize: 16, fontWeight: "900" },
  secondaryButton: { alignItems: "center", borderColor: colors.outline, borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 54 },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
