import type { Combatant } from "@codexwars/shared";
import type { PlayerState } from "./state.js";

export function combatantFromPlayer(player: PlayerState): Combatant {
  return {
    combatIncluded: player.combatIncluded,
    connected: player.connected,
    correctAnswers: player.correctAnswers,
    displayName: player.displayName,
    eliminated: player.eliminated,
    hp: player.hp,
    playerId: player.playerId,
    position: player.positionLocked ? { x: player.positionX, z: player.positionZ } : undefined,
    shield: player.shield
  };
}
