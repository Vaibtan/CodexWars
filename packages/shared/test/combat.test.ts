import { describe, expect, it } from "vitest";
import { applyDamage, normalizeDirection, resolveBoltAttack, standingsFor, validatePosition, type Combatant } from "../src/index.js";

function combatant(playerId: string, x: number, z: number, overrides: Partial<Combatant> = {}): Combatant {
  return {
    combatIncluded: true,
    connected: true,
    correctAnswers: 0,
    displayName: playerId,
    eliminated: false,
    hp: 100,
    playerId,
    position: { x, z },
    shield: 0,
    ...overrides
  };
}

describe("shared position rules", () => {
  it("rejects non-finite coordinates and accepts each exact distance boundary", () => {
    expect(validatePosition({ x: Number.NaN, z: 1 }, 6, [])).toMatchObject({ ok: false, reason: "POSITION_INVALID" });
    expect(validatePosition({ x: 1, z: Number.POSITIVE_INFINITY }, 6, [])).toMatchObject({ ok: false, reason: "POSITION_INVALID" });
    expect(validatePosition({ x: 0.75, z: 0 }, 6, [])).toEqual({ ok: true });
    expect(validatePosition({ x: 0.749, z: 0 }, 6, [])).toMatchObject({ ok: false, reason: "POSITION_IN_MARKER_EXCLUSION" });
    expect(validatePosition({ x: 6, z: 0 }, 6, [])).toEqual({ ok: true });
    expect(validatePosition({ x: 6.001, z: 0 }, 6, [])).toMatchObject({ ok: false, reason: "POSITION_OUT_OF_BOUNDS" });
    expect(validatePosition({ x: 2.5, z: 0 }, 6, [combatant("player-1", 1, 0)])).toEqual({ ok: true });
    expect(validatePosition({ x: 2.499, z: 0 }, 6, [combatant("player-1", 1, 0)])).toMatchObject({ ok: false, reason: "SPACING_VIOLATION" });
  });

  it("returns a finite correction to an exact valid spacing location", () => {
    const result = validatePosition({ x: 1, z: 0 }, 6, [combatant("player-1", 1, 0)]);

    expect(result).toEqual({
      conflictsWithPlayerId: "player-1",
      correction: { x: 1.5, z: 0 },
      distanceM: 1.5,
      ok: false,
      reason: "SPACING_VIOLATION"
    });
    if (result.ok) throw new Error("Expected a spacing correction");
    expect(Number.isFinite(result.correction.x)).toBe(true);
    expect(Number.isFinite(result.correction.z)).toBe(true);
    expect(validatePosition({ x: 1 + result.correction.x, z: result.correction.z }, 6, [combatant("player-1", 1, 0)])).toEqual({ ok: true });
  });
});

describe("shared combat rules", () => {
  it("accepts direction magnitudes at 0.1 and 2.0 and rejects values outside them", () => {
    expect(normalizeDirection(0.1, 0)).toEqual({ direction: { x: 1, z: 0 }, ok: true });
    expect(normalizeDirection(2, 0)).toEqual({ direction: { x: 1, z: 0 }, ok: true });
    expect(normalizeDirection(0.099, 0)).toEqual({ ok: false });
    expect(normalizeDirection(2.001, 0)).toEqual({ ok: false });
    expect(normalizeDirection(Number.NaN, 1)).toEqual({ ok: false });
  });

  it("ignores opponents behind, outside range, or ineligible for combat", () => {
    const attacker = combatant("attacker", 0, 0);
    const opponents = [
      combatant("behind", -1, 0),
      combatant("outside", 8.001, 0),
      combatant("disconnected", 2, 0, { connected: false }),
      combatant("eliminated", 2, 0, { eliminated: true }),
      combatant("quiz-only", 2, 0, { combatIncluded: false }),
      combatant("unpositioned", 2, 0, { position: undefined })
    ];

    expect(resolveBoltAttack(attacker, opponents, { x: 1, z: 0 })).toEqual({ damage: 0, target: undefined });
  });

  it("hits the nearest aligned opponent and breaks equal-distance ties by participant ID", () => {
    const attacker = combatant("attacker", 0, 0);
    const farther = combatant("player-1", 5, 0);
    const nearer = combatant("player-2", 3, 0);
    expect(resolveBoltAttack(attacker, [farther, nearer], { x: 1, z: 0 })).toEqual({ damage: 10, target: nearer });

    const laterId = combatant("player-b", 3, 0);
    const earlierId = combatant("player-a", 3, 0);
    expect(resolveBoltAttack(attacker, [laterId, earlierId], { x: 1, z: 0 })).toEqual({ damage: 10, target: earlierId });
  });

  it("resolves a valid miss without mutating either combatant", () => {
    const attacker = combatant("attacker", 0, 0, { shield: 10 });
    const opponent = combatant("opponent", 2, 2, { hp: 80 });
    const before = structuredClone({ attacker, opponent });

    expect(resolveBoltAttack(attacker, [opponent], { x: 1, z: 0 })).toEqual({ damage: 0, target: undefined });
    expect({ attacker, opponent }).toEqual(before);
  });

  it("consumes shield before HP, carries overflow, clamps at zero, and eliminates at exactly zero HP", () => {
    expect(applyDamage(100, 15, 10)).toEqual({ eliminated: false, hp: 100, shield: 5 });
    expect(applyDamage(100, 5, 10)).toEqual({ eliminated: false, hp: 95, shield: 0 });
    expect(applyDamage(5, 0, 5)).toEqual({ eliminated: true, hp: 0, shield: 0 });
    expect(applyDamage(5, 0, 10)).toEqual({ eliminated: true, hp: 0, shield: 0 });
    expect(applyDamage(-5, -3, 10)).toEqual({ eliminated: true, hp: 0, shield: 0 });
  });

  it("orders standings by HP, then quiz score, then stable participant ID", () => {
    const standings = standingsFor([
      combatant("player-3", 0, 0, { correctAnswers: 1, hp: 100 }),
      combatant("player-2", 0, 0, { correctAnswers: 5, hp: 100 }),
      combatant("player-4", 0, 0, { correctAnswers: 10, hp: 90 }),
      combatant("player-1", 0, 0, { correctAnswers: 5, hp: 100 })
    ]);

    expect(standings.map(({ playerId, rank }) => ({ playerId, rank }))).toEqual([
      { playerId: "player-1", rank: 1 },
      { playerId: "player-2", rank: 2 },
      { playerId: "player-3", rank: 3 },
      { playerId: "player-4", rank: 4 }
    ]);
  });
});
