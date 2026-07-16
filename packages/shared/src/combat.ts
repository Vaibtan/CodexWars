import { ARENA, PLAYER_HIT_RADIUS_M, WEAPONS } from "./constants.js";
import type { ArenaPosition, PlayerId, Standing } from "./types.js";

export interface Combatant {
  readonly combatIncluded: boolean;
  readonly connected: boolean;
  readonly correctAnswers: number;
  readonly displayName: string;
  readonly eliminated: boolean;
  readonly hp: number;
  readonly playerId: PlayerId;
  readonly position: ArenaPosition | undefined;
  readonly shield: number;
}

export interface NormalizedDirection {
  readonly x: number;
  readonly z: number;
}

export type DirectionResult = { readonly ok: true; readonly direction: NormalizedDirection } | { readonly ok: false };

export function normalizeDirection(x: number, z: number): DirectionResult {
  const magnitude = Math.hypot(x, z);
  if (!Number.isFinite(magnitude) || magnitude < 0.1 || magnitude > 2) return { ok: false };
  return { ok: true, direction: { x: x / magnitude, z: z / magnitude } };
}

export interface PositionValidationSuccess {
  readonly ok: true;
}

export interface PositionValidationFailure {
  readonly conflictsWithPlayerId?: PlayerId;
  readonly correction: ArenaPosition;
  readonly distanceM: number;
  readonly ok: false;
  readonly reason: "POSITION_INVALID" | "POSITION_IN_MARKER_EXCLUSION" | "POSITION_OUT_OF_BOUNDS" | "SPACING_VIOLATION";
}

export type PositionValidation = PositionValidationSuccess | PositionValidationFailure;

function correctionFrom(origin: ArenaPosition, candidate: ArenaPosition, desiredDistance: number): ArenaPosition {
  const x = candidate.x - origin.x;
  const z = candidate.z - origin.z;
  const distance = Math.hypot(x, z);
  const direction = distance === 0 ? { x: 1, z: 0 } : { x: x / distance, z: z / distance };
  const correctionDistance = desiredDistance - distance;
  return { x: direction.x * correctionDistance, z: direction.z * correctionDistance };
}

export function validatePosition(candidate: ArenaPosition, radiusM: number, lockedCombatants: readonly Combatant[]): PositionValidation {
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) {
    return { correction: { x: 0, z: 0 }, distanceM: 0, ok: false, reason: "POSITION_INVALID" };
  }
  const markerDistance = Math.hypot(candidate.x, candidate.z);
  if (markerDistance < ARENA.MARKER_EXCLUSION_RADIUS_M) {
    const correction = correctionFrom({ x: 0, z: 0 }, candidate, ARENA.MARKER_EXCLUSION_RADIUS_M);
    return { correction, distanceM: Math.hypot(correction.x, correction.z), ok: false, reason: "POSITION_IN_MARKER_EXCLUSION" };
  }
  if (markerDistance > radiusM) {
    const correction = correctionFrom({ x: 0, z: 0 }, candidate, radiusM);
    return { correction, distanceM: Math.hypot(correction.x, correction.z), ok: false, reason: "POSITION_OUT_OF_BOUNDS" };
  }
  for (const combatant of lockedCombatants) {
    if (combatant.position === undefined) continue;
    const distance = Math.hypot(candidate.x - combatant.position.x, candidate.z - combatant.position.z);
    if (distance < ARENA.MIN_SPACING_M) {
      const correction = correctionFrom(combatant.position, candidate, ARENA.MIN_SPACING_M);
      return {
        conflictsWithPlayerId: combatant.playerId,
        correction,
        distanceM: Math.hypot(correction.x, correction.z),
        ok: false,
        reason: "SPACING_VIOLATION"
      };
    }
  }
  return { ok: true };
}

export interface AttackResolution {
  readonly damage: number;
  readonly target: Combatant | undefined;
}

export function resolveBoltAttack(attacker: Combatant, opponents: readonly Combatant[], direction: NormalizedDirection): AttackResolution {
  if (attacker.position === undefined) return { damage: 0, target: undefined };
  const hitRadius = PLAYER_HIT_RADIUS_M + WEAPONS.bolt.rayRadiusM;
  let target: Combatant | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const opponent of opponents) {
    if (!opponent.combatIncluded || !opponent.connected || opponent.eliminated || opponent.position === undefined) continue;
    const relativeX = opponent.position.x - attacker.position.x;
    const relativeZ = opponent.position.z - attacker.position.z;
    const projection = relativeX * direction.x + relativeZ * direction.z;
    if (projection < 0 || projection > WEAPONS.bolt.rangeM) continue;
    const perpendicularSquared = relativeX * relativeX + relativeZ * relativeZ - projection * projection;
    const intersection = hitRadius * hitRadius - perpendicularSquared;
    if (intersection < 0) continue;
    const entryDistance = Math.max(0, projection - Math.sqrt(intersection));
    if (entryDistance < nearestDistance || (entryDistance === nearestDistance && opponent.playerId < (target?.playerId ?? ""))) {
      nearestDistance = entryDistance;
      target = opponent;
    }
  }
  return { damage: target === undefined ? 0 : WEAPONS.bolt.damage, target };
}

export interface DamageResult {
  readonly eliminated: boolean;
  readonly hp: number;
  readonly shield: number;
}

export function applyDamage(hp: number, shield: number, damage: number): DamageResult {
  const shieldDamage = Math.min(Math.max(shield, 0), damage);
  const nextShield = Math.max(0, shield - shieldDamage);
  const nextHp = Math.max(0, hp - (damage - shieldDamage));
  return { eliminated: nextHp === 0, hp: nextHp, shield: nextShield };
}

export function standingsFor(combatants: readonly Combatant[]): readonly Standing[] {
  return [...combatants]
    .sort((left, right) => right.hp - left.hp || right.correctAnswers - left.correctAnswers || left.playerId.localeCompare(right.playerId))
    .map((combatant, index) => ({
      correctAnswers: combatant.correctAnswers,
      displayName: combatant.displayName,
      eliminated: combatant.eliminated,
      hp: combatant.hp,
      playerId: combatant.playerId,
      rank: index + 1,
      shield: combatant.shield
    }));
}
