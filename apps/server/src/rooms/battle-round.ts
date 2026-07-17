import { ArraySchema } from "@colyseus/schema";
import {
  applyDamage,
  BATTLE,
  normalizeDirection,
  resolveBoltAttack,
  standingsFor,
  startingShieldForScore,
  WEAPONS,
  type ErrorCode,
  type PlayerId,
  type ServerEventPayloads,
  type Standing
} from "@codexwars/shared";
import { BattleState, PlayerState, StandingState, WarRoomState } from "./state.js";
import { combatantFromPlayer } from "./combatant-state.js";

type BattleEventName = "attack_resolved" | "battle_completed" | "battle_countdown_started" | "player_eliminated";

export type BattleRoundEvent = {
  [Name in BattleEventName]: { readonly payload: ServerEventPayloads[Name]; readonly type: Name }
}[BattleEventName];

export interface BattleBlocker {
  readonly playerId: string;
  readonly reason: string;
}

export type BattleStartResult =
  | { readonly ok: true }
  | { readonly blockers: readonly BattleBlocker[]; readonly ok: false };

export type BattleAttackResult =
  | { readonly ok: true }
  | { readonly errorCode: Extract<ErrorCode, "ATTACK_COOLDOWN" | "ATTACK_DIRECTION_INVALID" | "ATTACK_NOT_ALLOWED">; readonly ok: false };

export interface BattleAttack {
  readonly commandId: string;
  readonly dirX: number;
  readonly dirZ: number;
  readonly now: number;
  readonly playerId: PlayerId;
}

export class BattleRound {
  constructor(
    private readonly state: WarRoomState,
    private readonly emit: (event: BattleRoundEvent) => void
  ) {}

  start(now: number): BattleStartResult {
    const combatPlayers = [...this.state.players.values()].filter((player) => player.combatIncluded);
    const blockers = combatPlayers.flatMap((player) => this.startBlockers(player));
    if (combatPlayers.length < 2) blockers.push({ playerId: "room", reason: "MINIMUM_COMBATANTS" });
    if (blockers.length > 0) return { blockers, ok: false };

    for (const player of combatPlayers) {
      player.maxHp = BATTLE.START_HP;
      player.hp = BATTLE.START_HP;
      player.shield = startingShieldForScore(player.correctAnswers);
      player.charges = WEAPONS.bolt.charges;
      player.nextAttackAt = 0;
      player.eliminated = false;
    }
    this.state.phase = "countdown";
    this.state.battle.status = "countdown";
    this.state.battle.startsAt = now + BATTLE.COUNTDOWN_MS;
    this.state.battle.endsAt = this.state.battle.startsAt + BATTLE.DURATION_MS;
    this.emit({
      payload: { endsAt: this.state.battle.endsAt, startsAt: this.state.battle.startsAt },
      type: "battle_countdown_started"
    });
    return { ok: true };
  }

  attack(command: BattleAttack): BattleAttackResult {
    const attacker = this.state.players.get(command.playerId);
    if (!this.canAttack(attacker, command.now)) return { errorCode: "ATTACK_NOT_ALLOWED", ok: false };
    const direction = normalizeDirection(command.dirX, command.dirZ);
    if (!direction.ok) return { errorCode: "ATTACK_DIRECTION_INVALID", ok: false };
    if (command.now < attacker.nextAttackAt) return { errorCode: "ATTACK_COOLDOWN", ok: false };

    attacker.nextAttackAt = command.now + WEAPONS.bolt.cooldownMs;
    const opponents = [...this.state.players.values()]
      .filter((player) => player.playerId !== attacker.playerId)
      .map(combatantFromPlayer);
    const resolution = resolveBoltAttack(combatantFromPlayer(attacker), opponents, direction.direction);
    if (resolution.target === undefined) {
      this.emit({
        payload: {
          attackerId: attacker.playerId,
          commandId: command.commandId,
          damage: 0,
          targetHp: null,
          targetId: null,
          targetShield: null
        },
        type: "attack_resolved"
      });
      this.completeIfLastAlive();
      return { ok: true };
    }

    const target = this.state.players.get(resolution.target.playerId)!;
    applyBoltDamage(target);
    this.emit({
      payload: {
        attackerId: attacker.playerId,
        commandId: command.commandId,
        damage: WEAPONS.bolt.damage,
        targetHp: target.hp,
        targetId: target.playerId,
        targetShield: target.shield
      },
      type: "attack_resolved"
    });
    if (target.eliminated) {
      this.emit({
        payload: { eliminatedByPlayerId: attacker.playerId, playerId: target.playerId },
        type: "player_eliminated"
      });
    }
    this.completeIfLastAlive();
    return { ok: true };
  }

  advance(now: number): void {
    if (this.state.phase === "countdown" && now >= this.state.battle.startsAt) {
      this.state.phase = "battle";
      this.state.battle.status = "active";
    }
    if (this.state.phase === "battle" && now >= this.state.battle.endsAt) this.finish("timer");
  }

  completeIfLastAlive(): void {
    const alive = [...this.state.players.values()].filter((player) => player.combatIncluded && !player.eliminated);
    if (alive.length <= 1) this.finish("last_alive");
  }

  reset(): void {
    this.state.battle = new BattleState();
  }

  private canAttack(attacker: PlayerState | undefined, now: number): attacker is PlayerState {
    return attacker !== undefined
      && this.state.phase === "battle"
      && this.state.battle.status === "active"
      && now >= this.state.battle.startsAt
      && now < this.state.battle.endsAt
      && attacker.connected
      && attacker.combatIncluded
      && !attacker.eliminated
      && attacker.positionLocked
      && attacker.localization !== "lost";
  }

  private finish(reason: "last_alive" | "timer"): void {
    if (this.state.battle.status === "completed") return;
    const standings = standingsFor(
      [...this.state.players.values()].filter((player) => player.combatIncluded).map(combatantFromPlayer)
    );
    const winner = standings[0];
    this.state.phase = "results";
    this.state.battle.status = "completed";
    this.state.battle.completionReason = reason;
    this.state.battle.winnerId = winner?.playerId ?? "";
    const stateStandings = new ArraySchema<StandingState>();
    for (const standing of standings) stateStandings.push(toStandingState(standing));
    this.state.battle.standings = stateStandings;
    this.emit({
      payload: { reason, standings, winnerId: this.state.battle.winnerId },
      type: "battle_completed"
    });
  }

  private startBlockers(player: PlayerState): readonly BattleBlocker[] {
    const blockers: BattleBlocker[] = [];
    if (!player.connected) blockers.push({ playerId: player.playerId, reason: "DISCONNECTED" });
    if (!player.quizCompleted) blockers.push({ playerId: player.playerId, reason: "QUIZ_INCOMPLETE" });
    if (player.localization !== "localized") blockers.push({ playerId: player.playerId, reason: "NOT_LOCALIZED" });
    if (!player.positionLocked) blockers.push({ playerId: player.playerId, reason: "POSITION_UNLOCKED" });
    if (!player.ready) blockers.push({ playerId: player.playerId, reason: "NOT_READY" });
    if (player.eliminated) blockers.push({ playerId: player.playerId, reason: "ELIMINATED" });
    return blockers;
  }
}

function applyBoltDamage(target: PlayerState): void {
  const result = applyDamage(target.hp, target.shield, WEAPONS.bolt.damage);
  target.shield = result.shield;
  target.hp = result.hp;
  target.eliminated = result.eliminated;
}

function toStandingState(standing: Standing): StandingState {
  const state = new StandingState();
  state.rank = standing.rank;
  state.playerId = standing.playerId;
  state.displayName = standing.displayName;
  state.hp = standing.hp;
  state.shield = standing.shield;
  state.correctAnswers = standing.correctAnswers;
  state.eliminated = standing.eliminated;
  return state;
}
