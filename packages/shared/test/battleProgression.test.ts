import { describe, expect, it } from "vitest";
import {
  deriveBattleLoadout,
  InvalidQuizPerformanceError,
} from "../src/battle/index.js";

describe("deriveBattleLoadout", () => {
  it("creates a fair base loadout when no answers are correct", () => {
    expect(deriveBattleLoadout({ correctAnswers: 0, totalQuestions: 10 })).toMatchObject({
      abilities: [],
      hp: 100,
      maxHp: 100,
      shield: 0,
      weapons: {
        bolt: { charges: null, cooldownMs: 1_000, damage: 10, unlocked: true },
        fireball: { charges: 0, cooldownMs: 2_000, damage: 20, unlocked: false },
      },
    });
  });

  it.each([
    [1, 5, 10, 0, 1_000, 0],
    [2, 10, 10, 0, 1_000, 0],
    [3, 10, 11, 0, 1_000, 1],
    [4, 15, 11, 0, 1_000, 1],
    [5, 15, 11, 1, 1_000, 2],
    [6, 20, 11, 1, 1_000, 2],
    [7, 20, 12, 1, 1_000, 2],
    [8, 20, 12, 2, 1_000, 3],
    [9, 30, 12, 2, 1_000, 3],
    [10, 40, 12, 2, 850, 5],
  ])(
    "%i correct answers yields the versioned cumulative reward",
    (correctAnswers, shield, boltDamage, fireballCharges, boltCooldownMs, abilityCount) => {
      const loadout = deriveBattleLoadout({ correctAnswers, totalQuestions: 10 });

      expect({
        abilityCount: loadout.abilities.length,
        boltCooldownMs: loadout.weapons.bolt.cooldownMs,
        boltDamage: loadout.weapons.bolt.damage,
        fireballCharges: loadout.weapons.fireball.charges,
        fireballDamage: loadout.weapons.fireball.damage,
        fireballUnlocked: loadout.weapons.fireball.unlocked,
        maxHp: loadout.maxHp,
        shield: loadout.shield,
      }).toEqual({
        abilityCount,
        boltCooldownMs,
        boltDamage,
        fireballCharges,
        fireballDamage: correctAnswers === 10 ? 24 : 20,
        fireballUnlocked: correctAnswers >= 5,
        maxHp: 100,
        shield,
      });
    },
  );

  it.each([
    [-1, 10],
    [11, 10],
    [1.5, 10],
    [1, 0],
    [1, 10.5],
  ])("rejects invalid quiz performance %s/%s", (correctAnswers, totalQuestions) => {
    expect(() => deriveBattleLoadout({ correctAnswers, totalQuestions })).toThrow(
      InvalidQuizPerformanceError,
    );
  });
});
