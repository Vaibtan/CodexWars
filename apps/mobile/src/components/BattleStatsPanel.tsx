import { StyleSheet, Text, View } from "react-native";
import { QUIZ, WEAPONS, startingShieldForScore, type PlayerPublicState } from "@codexwars/shared";
import { colors } from "./theme";

type BattleStatsPanelProps = {
  label?: string;
  player: PlayerPublicState;
};

const maximumQuizShield = startingShieldForScore(QUIZ.QUESTION_COUNT);

export function BattleStatsPanel({ label = "Your battle stats", player }: BattleStatsPanelProps) {
  const hpPercent = Math.round((player.hp / player.maxHp) * 100);
  const shieldPercent = Math.round((player.shield / maximumQuizShield) * 100);

  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.effectiveHealth}>{player.hp + player.shield} effective HP</Text>
        </View>
        <View style={styles.quizBadge}>
          <Text style={styles.quizBadgeValue}>{player.correctAnswers}/{QUIZ.QUESTION_COUNT}</Text>
          <Text style={styles.quizBadgeLabel}>correct</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <Text style={styles.statName}>Health</Text>
        <Text style={styles.statValue}>{player.hp} / {player.maxHp}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ max: player.maxHp, min: 0, now: player.hp }} style={styles.track}>
        <View style={[styles.healthFill, { width: `${hpPercent}%` }]} />
      </View>

      <View style={styles.statRow}>
        <Text style={styles.statName}>Quiz shield</Text>
        <Text style={styles.statValue}>{player.shield}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ max: maximumQuizShield, min: 0, now: player.shield }} style={styles.track}>
        <View style={[styles.shieldFill, { width: `${shieldPercent}%` }]} />
      </View>

      <View style={styles.weaponRow}>
        <View style={styles.weaponStat}>
          <Text style={styles.weaponValue}>{WEAPONS.bolt.damage}</Text>
          <Text style={styles.weaponLabel}>bolt damage</Text>
        </View>
        <View style={styles.weaponStat}>
          <Text style={styles.weaponValue}>Unlimited</Text>
          <Text style={styles.weaponLabel}>bolt charges</Text>
        </View>
        <View style={styles.weaponStat}>
          <Text style={styles.weaponValue}>{WEAPONS.bolt.cooldownMs} ms</Text>
          <Text style={styles.weaponLabel}>bolt cooldown</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.backgroundRaised, borderRadius: 14, padding: 15 },
  headingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headingCopy: { flex: 1 },
  label: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  effectiveHealth: { color: colors.inkMuted, fontSize: 12, marginTop: 3 },
  quizBadge: { alignItems: "center", backgroundColor: colors.surfaceStrong, borderRadius: 10, minWidth: 62, paddingHorizontal: 10, paddingVertical: 7 },
  quizBadgeValue: { color: colors.accent, fontSize: 15, fontWeight: "900" },
  quizBadgeLabel: { color: colors.inkSubtle, fontSize: 9, marginTop: 1 },
  statRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  statName: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  statValue: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  track: { backgroundColor: colors.surfaceStrong, borderRadius: 4, height: 7, marginTop: 6, overflow: "hidden" },
  healthFill: { backgroundColor: colors.success, borderRadius: 4, height: 7 },
  shieldFill: { backgroundColor: colors.accent, borderRadius: 4, height: 7 },
  weaponRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  weaponStat: { backgroundColor: colors.surface, borderRadius: 10, flex: 1, minHeight: 58, paddingHorizontal: 8, paddingVertical: 9 },
  weaponValue: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  weaponLabel: { color: colors.inkSubtle, fontSize: 9, lineHeight: 12, marginTop: 3 },
});
