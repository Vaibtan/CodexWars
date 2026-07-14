import { StyleSheet, Text, View } from "react-native";
import type { BattleLoadout } from "@codexwars/shared";
import { colors } from "./theme";

type BattleStatsPanelProps = {
  battleStats: BattleLoadout;
  label?: string;
  showAbilities?: boolean;
};

export function BattleStatsPanel({
  battleStats,
  label = "Your battle stats",
  showAbilities = false,
}: BattleStatsPanelProps) {
  const hpPercent = Math.round((battleStats.hp / battleStats.maxHp) * 100);
  const shieldPercent = battleStats.maxShield
    ? Math.round((battleStats.shield / battleStats.maxShield) * 100)
    : 0;
  const fireball = battleStats.weapons.fireball;

  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.effectiveHealth}>{battleStats.effectiveHealth} effective HP</Text>
        </View>
        <View style={styles.quizBadge}>
          <Text style={styles.quizBadgeValue}>{battleStats.correctAnswers}/{battleStats.totalQuestions}</Text>
          <Text style={styles.quizBadgeLabel}>correct</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <Text style={styles.statName}>Health</Text>
        <Text style={styles.statValue}>{battleStats.hp} / {battleStats.maxHp}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ max: battleStats.maxHp, min: 0, now: battleStats.hp }}
        style={styles.track}
      >
        <View style={[styles.healthFill, { width: `${hpPercent}%` }]} />
      </View>

      <View style={styles.statRow}>
        <Text style={styles.statName}>Shield</Text>
        <Text style={styles.statValue}>{battleStats.shield} / {battleStats.maxShield}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ max: Math.max(1, battleStats.maxShield), min: 0, now: battleStats.shield }}
        style={styles.track}
      >
        <View style={[styles.shieldFill, { width: `${shieldPercent}%` }]} />
      </View>

      <View style={styles.weaponRow}>
        <View style={styles.weaponStat}>
          <Text style={styles.weaponValue}>{battleStats.weapons.bolt.damage}</Text>
          <Text style={styles.weaponLabel}>bolt damage</Text>
        </View>
        <View style={styles.weaponStat}>
          <Text style={styles.weaponValue}>{fireball.unlocked ? fireball.charges : "—"}</Text>
          <Text style={styles.weaponLabel}>fireballs</Text>
        </View>
        <View style={styles.weaponStat}>
          <Text style={styles.weaponValue}>{battleStats.weapons.bolt.cooldownMs} ms</Text>
          <Text style={styles.weaponLabel}>bolt cooldown</Text>
        </View>
      </View>

      {showAbilities && battleStats.abilities.length ? (
        <View style={styles.abilities}>
          <Text style={styles.abilitiesTitle}>Earned abilities</Text>
          {battleStats.abilities.map((ability) => (
            <View key={ability.id} style={styles.abilityRow}>
              <View style={styles.abilityDot} />
              <View style={styles.abilityCopy}>
                <Text style={styles.abilityName}>{ability.label}</Text>
                <Text style={styles.abilityDetail}>{ability.description}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
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
  abilities: { borderTopColor: colors.outline, borderTopWidth: 1, marginTop: 14, paddingTop: 12 },
  abilitiesTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", marginBottom: 4 },
  abilityRow: { alignItems: "flex-start", flexDirection: "row", gap: 9, paddingVertical: 5 },
  abilityDot: { backgroundColor: colors.accent, borderRadius: 4, height: 8, marginTop: 5, width: 8 },
  abilityCopy: { flex: 1 },
  abilityName: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  abilityDetail: { color: colors.inkSubtle, fontSize: 10, lineHeight: 14, marginTop: 1 },
});
