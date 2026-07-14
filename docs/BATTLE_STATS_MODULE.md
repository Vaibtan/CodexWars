# Battle Stats and HP Module

## Purpose

`@codexwars/shared/battle` is the server-authoritative rules module for turning a
finalized Quiz Result into Battle Stats and resolving already-targeted attacks.
It contains no React Native, Viro, Firebase, Colyseus, clock, or network code.

The current `quiz-abilities-v1` progression is a richer product policy than the
shield-only hackathon P0 mapping. The policy is versioned so the War Room can
select and persist the exact rules used for a battle.

## Invariants

- Every Combat Participant has 100 maximum HP. Quiz performance never adds HP.
- Shield is additive effective health and absorbs damage before HP.
- HP and shield never become negative.
- HP reaching zero marks a participant eliminated.
- Eliminated participants cannot attack or receive another attack resolution.
- Bolt has unlimited charges; Fireball must be unlocked and has finite charges.
- A rejected attack does not mutate either combatant.
- Character choice never changes Battle Stats.

## Quiz progression v1

Each correct answer applies one cumulative reward step. All values live in
`BATTLE_REWARD_STEPS_V1`; callers do not duplicate this table.

| Correct answer | Reward at this step | Cumulative headline state |
|---:|---|---|
| 1 | +5 shield | 105 effective HP |
| 2 | +5 shield | 110 effective HP |
| 3 | +1 Bolt damage | Bolt 11 |
| 4 | +5 shield | 115 effective HP |
| 5 | Unlock 1 Fireball | Fireball 20 × 1 |
| 6 | +5 shield | 120 effective HP |
| 7 | +1 Bolt damage | Bolt 12 |
| 8 | +1 Fireball charge | Fireball 20 × 2 |
| 9 | +10 shield | 130 effective HP |
| 10 | +10 shield, −150 ms Bolt cooldown, +4 Fireball damage | 140 effective HP, Bolt 12/850 ms, Fireball 24 × 2 |

## Shared interface

```ts
const battleStats = deriveBattleLoadout({
  correctAnswers: quizResult.correctAnswers,
  totalQuestions: 10,
});

const readiness = getWeaponReadiness(battleStats, "fireball", serverNowMs);

const result = resolveAttack({
  attacker: attackerBattleStats,
  target: selectedTargetBattleStats,
  weaponId: "fireball",
  nowMs: serverNowMs,
});
```

`resolveAttack` begins after the server has authenticated the sender and selected
the target using marker-space geometry. It owns weapon readiness, charges,
cooldown transition, shield-before-HP damage, clamping, and elimination. The
future War Room adapter must still own phase/start-time checks, request-ID
deduplication, rate limiting, 2D target selection, state revision, broadcasts,
and persistence of the Quiz Result.

## React Native adapter

`BattleStatsPanel` renders a `BattleLoadout` without recalculating any values.
`ParticipantBattleScreen` currently creates a local 7/10 demo loadout and uses
the shared transition functions. When realtime state arrives, replace the demo
initializer with the synchronized `PlayerState.battleStats`; the panel and
attack feedback do not need different rules.
