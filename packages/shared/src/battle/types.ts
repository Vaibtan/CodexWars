export type WeaponId = "bolt" | "fireball";

export type AbilityId =
  | "empowered-bolt"
  | "fireball"
  | "extra-fireball"
  | "rapid-bolt"
  | "empowered-fireball";

export interface QuizPerformance {
  correctAnswers: number;
  totalQuestions: number;
}

export interface AbilityUnlock {
  id: AbilityId;
  label: string;
  description: string;
  unlockedAtCorrectAnswers: number;
}

export interface WeaponStats {
  charges: number | null;
  cooldownMs: number;
  damage: number;
  nextReadyAtMs: number;
  unlocked: boolean;
}

export interface BattleLoadout {
  abilities: readonly AbilityUnlock[];
  correctAnswers: number;
  effectiveHealth: number;
  eliminated: boolean;
  hp: number;
  maxHp: number;
  maxShield: number;
  progressionId: "quiz-abilities-v1";
  shield: number;
  totalQuestions: number;
  weapons: Record<WeaponId, WeaponStats>;
}

export interface BattleRewardStep {
  ability?: AbilityUnlock;
  boltCooldownReductionMs?: number;
  boltDamageBonus?: number;
  correctAnswers: number;
  fireballChargesBonus?: number;
  fireballDamageBonus?: number;
  shieldBonus?: number;
}

export interface ResolveAttackInput {
  attacker: BattleLoadout;
  nowMs: number;
  target: BattleLoadout;
  weaponId: WeaponId;
}

export interface DamageResolution {
  amount: number;
  eliminated: boolean;
  hpDamage: number;
  remainingHp: number;
  remainingShield: number;
  shieldDamage: number;
}

export interface AppliedAttack {
  attacker: BattleLoadout;
  damage: DamageResolution;
  status: "applied";
  target: BattleLoadout;
  weaponId: WeaponId;
}

export type AttackRejectionCode =
  | "ATTACKER_ELIMINATED"
  | "COOLDOWN_ACTIVE"
  | "INVALID_TIME"
  | "NO_CHARGES"
  | "TARGET_ELIMINATED"
  | "WEAPON_LOCKED";

export interface RejectedAttack {
  attacker: BattleLoadout;
  code: AttackRejectionCode;
  retryAtMs?: number;
  status: "rejected";
  target: BattleLoadout;
  weaponId: WeaponId;
}

export type AttackResult = AppliedAttack | RejectedAttack;

export type WeaponUseResult =
  | { attacker: BattleLoadout; status: "applied"; weaponId: WeaponId }
  | {
      attacker: BattleLoadout;
      code: Exclude<AttackRejectionCode, "TARGET_ELIMINATED">;
      retryAtMs?: number;
      status: "rejected";
      weaponId: WeaponId;
    };

export type WeaponReadiness =
  | { ready: true }
  | {
      code: Exclude<AttackRejectionCode, "TARGET_ELIMINATED">;
      ready: false;
      remainingCooldownMs?: number;
      retryAtMs?: number;
    };
