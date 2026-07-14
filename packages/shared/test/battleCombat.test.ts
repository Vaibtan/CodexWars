import { describe, expect, it } from "vitest";
import {
  deriveBattleLoadout,
  getWeaponReadiness,
  resolveAttack,
} from "../src/battle/index.js";

describe("resolveAttack", () => {
  it("applies shield before HP and consumes the weapon charge and cooldown", () => {
    const attacker = deriveBattleLoadout({ correctAnswers: 5, totalQuestions: 10 });
    const target = deriveBattleLoadout({ correctAnswers: 4, totalQuestions: 10 });

    const result = resolveAttack({
      attacker,
      nowMs: 1_000,
      target,
      weaponId: "fireball",
    });

    expect(result).toEqual({
      attacker: {
        ...attacker,
        weapons: {
          ...attacker.weapons,
          fireball: {
            ...attacker.weapons.fireball,
            charges: 0,
            nextReadyAtMs: 3_000,
          },
        },
      },
      damage: {
        amount: 20,
        eliminated: false,
        hpDamage: 5,
        remainingHp: 95,
        remainingShield: 0,
        shieldDamage: 15,
      },
      status: "applied",
      target: {
        ...target,
        effectiveHealth: 95,
        hp: 95,
        shield: 0,
      },
      weaponId: "fireball",
    });
  });

  it("rejects an attack during cooldown without changing either combatant", () => {
    const attacker = deriveBattleLoadout({ correctAnswers: 0, totalQuestions: 10 });
    const target = deriveBattleLoadout({ correctAnswers: 0, totalQuestions: 10 });
    const coolingDown = {
      ...attacker,
      weapons: {
        ...attacker.weapons,
        bolt: { ...attacker.weapons.bolt, nextReadyAtMs: 2_000 },
      },
    };

    expect(
      resolveAttack({ attacker: coolingDown, nowMs: 1_500, target, weaponId: "bolt" }),
    ).toEqual({
      attacker: coolingDown,
      code: "COOLDOWN_ACTIVE",
      retryAtMs: 2_000,
      status: "rejected",
      target,
      weaponId: "bolt",
    });
  });

  it("rejects a weapon that was not earned from the quiz", () => {
    const attacker = deriveBattleLoadout({ correctAnswers: 4, totalQuestions: 10 });
    const target = deriveBattleLoadout({ correctAnswers: 0, totalQuestions: 10 });

    expect(resolveAttack({ attacker, nowMs: 1_000, target, weaponId: "fireball" })).toEqual({
      attacker,
      code: "WEAPON_LOCKED",
      status: "rejected",
      target,
      weaponId: "fireball",
    });
  });

  it("rejects a limited weapon with no charges remaining", () => {
    const earned = deriveBattleLoadout({ correctAnswers: 5, totalQuestions: 10 });
    const attacker = {
      ...earned,
      weapons: {
        ...earned.weapons,
        fireball: { ...earned.weapons.fireball, charges: 0 },
      },
    };
    const target = deriveBattleLoadout({ correctAnswers: 0, totalQuestions: 10 });

    expect(resolveAttack({ attacker, nowMs: 1_000, target, weaponId: "fireball" })).toMatchObject({
      attacker,
      code: "NO_CHARGES",
      status: "rejected",
      target,
    });
  });

  it.each([
    ["attacker", "ATTACKER_ELIMINATED"],
    ["target", "TARGET_ELIMINATED"],
  ] as const)("rejects an attack when the %s is eliminated", (combatant, code) => {
    const healthyAttacker = deriveBattleLoadout({ correctAnswers: 0, totalQuestions: 10 });
    const healthyTarget = deriveBattleLoadout({ correctAnswers: 0, totalQuestions: 10 });
    const eliminated = { ...healthyTarget, effectiveHealth: 0, eliminated: true, hp: 0 };
    const attacker = combatant === "attacker" ? { ...healthyAttacker, ...eliminated } : healthyAttacker;
    const target = combatant === "target" ? eliminated : healthyTarget;

    expect(resolveAttack({ attacker, nowMs: 1_000, target, weaponId: "bolt" })).toMatchObject({
      code,
      status: "rejected",
    });
  });

  it("clamps lethal damage at zero and marks elimination once", () => {
    const attacker = deriveBattleLoadout({ correctAnswers: 0, totalQuestions: 10 });
    const healthyTarget = deriveBattleLoadout({ correctAnswers: 0, totalQuestions: 10 });
    const target = { ...healthyTarget, effectiveHealth: 5, hp: 5 };

    const result = resolveAttack({ attacker, nowMs: 1_000, target, weaponId: "bolt" });

    expect(result).toMatchObject({
      damage: {
        eliminated: true,
        hpDamage: 5,
        remainingHp: 0,
        remainingShield: 0,
      },
      status: "applied",
      target: { effectiveHealth: 0, eliminated: true, hp: 0 },
    });
  });
});

describe("getWeaponReadiness", () => {
  it("reports cooldown time for UI without mutating battle state", () => {
    const base = deriveBattleLoadout({ correctAnswers: 0, totalQuestions: 10 });
    const battleStats = {
      ...base,
      weapons: {
        ...base.weapons,
        bolt: { ...base.weapons.bolt, nextReadyAtMs: 2_000 },
      },
    };

    expect(getWeaponReadiness(battleStats, "bolt", 1_400)).toEqual({
      code: "COOLDOWN_ACTIVE",
      ready: false,
      remainingCooldownMs: 600,
      retryAtMs: 2_000,
    });
    expect(battleStats.weapons.bolt.nextReadyAtMs).toBe(2_000);
  });

  it("reports locked, depleted, eliminated, invalid-time, and ready states", () => {
    const locked = deriveBattleLoadout({ correctAnswers: 4, totalQuestions: 10 });
    const earned = deriveBattleLoadout({ correctAnswers: 5, totalQuestions: 10 });
    const depleted = {
      ...earned,
      weapons: { ...earned.weapons, fireball: { ...earned.weapons.fireball, charges: 0 } },
    };
    const eliminated = { ...earned, effectiveHealth: 0, eliminated: true, hp: 0 };

    expect(getWeaponReadiness(locked, "fireball", 1_000)).toEqual({ code: "WEAPON_LOCKED", ready: false });
    expect(getWeaponReadiness(depleted, "fireball", 1_000)).toEqual({ code: "NO_CHARGES", ready: false });
    expect(getWeaponReadiness(eliminated, "bolt", 1_000)).toEqual({ code: "ATTACKER_ELIMINATED", ready: false });
    expect(getWeaponReadiness(earned, "bolt", Number.NaN)).toEqual({ code: "INVALID_TIME", ready: false });
    expect(getWeaponReadiness(earned, "fireball", 1_000)).toEqual({ ready: true });
  });
});
