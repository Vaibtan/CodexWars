import type {
  AbilityUnlock,
  BattleLoadout,
  BattleRewardStep,
  QuizPerformance,
} from "./types.js";

const BASE_HP = 100;
const SUPPORTED_QUESTION_COUNT = 10;

export class InvalidQuizPerformanceError extends Error {
  readonly code = "INVALID_QUIZ_PERFORMANCE";

  constructor(performance: QuizPerformance) {
    super(
      `Quiz performance must use ${SUPPORTED_QUESTION_COUNT} questions and an integer correct-answer count within range; received ${performance.correctAnswers}/${performance.totalQuestions}.`,
    );
    this.name = "InvalidQuizPerformanceError";
  }
}

const ability = (
  id: AbilityUnlock["id"],
  label: string,
  description: string,
  unlockedAtCorrectAnswers: number,
): AbilityUnlock => ({ id, label, description, unlockedAtCorrectAnswers });

export const BATTLE_REWARD_STEPS_V1: readonly BattleRewardStep[] = [
  { correctAnswers: 1, shieldBonus: 5 },
  { correctAnswers: 2, shieldBonus: 5 },
  {
    ability: ability("empowered-bolt", "Empowered bolt", "Basic bolts deal 1 more damage.", 3),
    boltDamageBonus: 1,
    correctAnswers: 3,
  },
  { correctAnswers: 4, shieldBonus: 5 },
  {
    ability: ability("fireball", "Fireball", "Unlock one high-impact fireball.", 5),
    correctAnswers: 5,
    fireballChargesBonus: 1,
  },
  { correctAnswers: 6, shieldBonus: 5 },
  { boltDamageBonus: 1, correctAnswers: 7 },
  {
    ability: ability("extra-fireball", "Extra fireball", "Carry one additional fireball charge.", 8),
    correctAnswers: 8,
    fireballChargesBonus: 1,
  },
  { correctAnswers: 9, shieldBonus: 10 },
  {
    ability: ability("rapid-bolt", "Rapid bolt", "Bolt cooldown is reduced by 150 ms.", 10),
    boltCooldownReductionMs: 150,
    correctAnswers: 10,
    fireballDamageBonus: 4,
    shieldBonus: 10,
  },
  {
    ability: ability("empowered-fireball", "Empowered fireball", "Fireballs deal 4 more damage.", 10),
    correctAnswers: 10,
  },
] as const;

export function deriveBattleLoadout(performance: QuizPerformance): BattleLoadout {
  if (
    !Number.isInteger(performance.correctAnswers) ||
    !Number.isInteger(performance.totalQuestions) ||
    performance.totalQuestions !== SUPPORTED_QUESTION_COUNT ||
    performance.correctAnswers < 0 ||
    performance.correctAnswers > performance.totalQuestions
  ) {
    throw new InvalidQuizPerformanceError(performance);
  }

  const earnedSteps = BATTLE_REWARD_STEPS_V1.filter(
    (step) => step.correctAnswers <= performance.correctAnswers,
  );
  const shield = earnedSteps.reduce((total, step) => total + (step.shieldBonus ?? 0), 0);
  const boltDamage = 10 + earnedSteps.reduce((total, step) => total + (step.boltDamageBonus ?? 0), 0);
  const boltCooldownMs = 1_000 - earnedSteps.reduce(
    (total, step) => total + (step.boltCooldownReductionMs ?? 0),
    0,
  );
  const fireballCharges = earnedSteps.reduce(
    (total, step) => total + (step.fireballChargesBonus ?? 0),
    0,
  );
  const fireballDamage = 20 + earnedSteps.reduce(
    (total, step) => total + (step.fireballDamageBonus ?? 0),
    0,
  );

  return {
    abilities: earnedSteps.flatMap((step) => (step.ability ? [step.ability] : [])),
    correctAnswers: performance.correctAnswers,
    effectiveHealth: BASE_HP + shield,
    eliminated: false,
    hp: BASE_HP,
    maxHp: BASE_HP,
    maxShield: shield,
    progressionId: "quiz-abilities-v1",
    shield,
    totalQuestions: performance.totalQuestions,
    weapons: {
      bolt: {
        charges: null,
        cooldownMs: boltCooldownMs,
        damage: boltDamage,
        nextReadyAtMs: 0,
        unlocked: true,
      },
      fireball: {
        charges: fireballCharges,
        cooldownMs: 2_000,
        damage: fireballDamage,
        nextReadyAtMs: 0,
        unlocked: fireballCharges > 0,
      },
    },
  };
}
