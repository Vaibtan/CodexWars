export {
  BATTLE_REWARD_STEPS_V1,
  deriveBattleLoadout,
  InvalidQuizPerformanceError,
} from "./progression.js";
export { consumeWeaponUse, getWeaponReadiness, resolveAttack } from "./combat.js";
export {
  findNearestAimTarget,
  normalizeAimDirection,
  PLAYER_HIT_RADIUS_M,
  WEAPON_GEOMETRY,
} from "./geometry.js";
export type {
  AppliedAttack,
  AttackRejectionCode,
  AttackResult,
  AbilityId,
  AbilityUnlock,
  BattleLoadout,
  BattleRewardStep,
  DamageResolution,
  QuizPerformance,
  ResolveAttackInput,
  RejectedAttack,
  WeaponId,
  WeaponReadiness,
  WeaponStats,
  WeaponUseResult,
} from "./types.js";
export type { AimCandidate, AimHit } from "./geometry.js";
