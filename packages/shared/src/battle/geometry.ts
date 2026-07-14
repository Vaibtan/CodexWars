import type { ArenaPosition } from "../index.js";
import type { WeaponId } from "./types.js";

export const PLAYER_HIT_RADIUS_M = 0.45;

export const WEAPON_GEOMETRY: Readonly<Record<WeaponId, { rangeM: number; rayRadiusM: number }>> = {
  bolt: { rangeM: 8, rayRadiusM: 0.35 },
  fireball: { rangeM: 7, rayRadiusM: 0.55 },
};

export interface AimCandidate {
  id: string;
  position: ArenaPosition;
}

export interface AimHit {
  distanceAlongRayM: number;
  targetId: string;
}

export function normalizeAimDirection(dirX: number, dirZ: number): ArenaPosition | null {
  if (!Number.isFinite(dirX) || !Number.isFinite(dirZ)) return null;
  const magnitude = Math.hypot(dirX, dirZ);
  if (magnitude < 0.1) return null;
  return { x: dirX / magnitude, z: dirZ / magnitude };
}

/** Returns the nearest eligible player circle intersected by the floor-plane attack ray. */
export function findNearestAimTarget(
  origin: ArenaPosition,
  dirX: number,
  dirZ: number,
  candidates: readonly AimCandidate[],
  weaponId: WeaponId,
): AimHit | null {
  const direction = normalizeAimDirection(dirX, dirZ);
  if (!direction) return null;
  const geometry = WEAPON_GEOMETRY[weaponId];
  const allowedDistance = PLAYER_HIT_RADIUS_M + geometry.rayRadiusM;
  let nearest: AimHit | null = null;

  for (const candidate of candidates) {
    const relativeX = candidate.position.x - origin.x;
    const relativeZ = candidate.position.z - origin.z;
    const forward = relativeX * direction.x + relativeZ * direction.z;
    if (forward <= 0 || forward > geometry.rangeM) continue;
    const perpendicular = Math.abs(relativeX * direction.z - relativeZ * direction.x);
    if (perpendicular > allowedDistance) continue;
    if (!nearest || forward < nearest.distanceAlongRayM) {
      nearest = { distanceAlongRayM: forward, targetId: candidate.id };
    }
  }

  return nearest;
}
