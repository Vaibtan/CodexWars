import type {
  AttackResult,
  AttackRejectionCode,
  BattleLoadout,
  ResolveAttackInput,
  WeaponId,
  WeaponReadiness,
  WeaponStats,
  WeaponUseResult,
} from "./types.js";

export function getWeaponReadiness(
  battleStats: BattleLoadout,
  weaponId: WeaponId,
  nowMs: number,
): WeaponReadiness {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    return { code: "INVALID_TIME", ready: false };
  }
  if (battleStats.eliminated || battleStats.hp === 0) {
    return { code: "ATTACKER_ELIMINATED", ready: false };
  }
  const weapon = battleStats.weapons[weaponId];
  if (!weapon.unlocked) {
    return { code: "WEAPON_LOCKED", ready: false };
  }
  if (weapon.charges !== null && weapon.charges <= 0) {
    return { code: "NO_CHARGES", ready: false };
  }
  if (nowMs < weapon.nextReadyAtMs) {
    return {
      code: "COOLDOWN_ACTIVE",
      ready: false,
      remainingCooldownMs: weapon.nextReadyAtMs - nowMs,
      retryAtMs: weapon.nextReadyAtMs,
    };
  }
  return { ready: true };
}

function reject(
  input: ResolveAttackInput,
  code: AttackRejectionCode,
  retryAtMs?: number,
): AttackResult {
  return {
    attacker: input.attacker,
    code,
    ...(retryAtMs === undefined ? {} : { retryAtMs }),
    status: "rejected",
    target: input.target,
    weaponId: input.weaponId,
  };
}

export function resolveAttack(input: ResolveAttackInput): AttackResult {
  const weapon = input.attacker.weapons[input.weaponId];
  const readiness = getWeaponReadiness(input.attacker, input.weaponId, input.nowMs);
  if (!readiness.ready) {
    return reject(input, readiness.code, readiness.retryAtMs);
  }
  if (input.target.eliminated || input.target.hp === 0) {
    return reject(input, "TARGET_ELIMINATED");
  }
  const shieldDamage = Math.min(input.target.shield, weapon.damage);
  const hpDamage = Math.min(input.target.hp, weapon.damage - shieldDamage);
  const remainingShield = input.target.shield - shieldDamage;
  const remainingHp = input.target.hp - hpDamage;
  const nextWeapon: WeaponStats = {
    ...weapon,
    charges: weapon.charges === null ? null : weapon.charges - 1,
    nextReadyAtMs: input.nowMs + weapon.cooldownMs,
  };
  const attacker: BattleLoadout = {
    ...input.attacker,
    weapons: { ...input.attacker.weapons, [input.weaponId]: nextWeapon },
  };
  const target: BattleLoadout = {
    ...input.target,
    effectiveHealth: remainingHp + remainingShield,
    eliminated: remainingHp === 0,
    hp: remainingHp,
    shield: remainingShield,
  };

  return {
    attacker,
    damage: {
      amount: weapon.damage,
      eliminated: target.eliminated,
      hpDamage,
      remainingHp,
      remainingShield,
      shieldDamage,
    },
    status: "applied",
    target,
    weaponId: input.weaponId,
  };
}

/** Consumes cooldown/charges for a valid shot that did not hit a target. */
export function consumeWeaponUse(
  attacker: BattleLoadout,
  weaponId: WeaponId,
  nowMs: number,
): WeaponUseResult {
  const readiness = getWeaponReadiness(attacker, weaponId, nowMs);
  if (!readiness.ready) {
    return {
      attacker,
      code: readiness.code,
      ...(readiness.retryAtMs === undefined ? {} : { retryAtMs: readiness.retryAtMs }),
      status: "rejected",
      weaponId,
    };
  }
  const weapon = attacker.weapons[weaponId];
  return {
    attacker: {
      ...attacker,
      weapons: {
        ...attacker.weapons,
        [weaponId]: {
          ...weapon,
          charges: weapon.charges === null ? null : weapon.charges - 1,
          nextReadyAtMs: nowMs + weapon.cooldownMs,
        },
      },
    },
    status: "applied",
    weaponId,
  };
}
