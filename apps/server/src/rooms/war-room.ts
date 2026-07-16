import { ArraySchema } from "@colyseus/schema";
import { createHash } from "node:crypto";
import { Client, Room } from "@colyseus/core";
import {
  ARENA,
  applyDamage,
  ATTACK_COMMANDS_PER_SECOND,
  BATTLE,
  COMMAND_NAMES,
  isPublicRoomStateProjection,
  isOrganizerCommand,
  isPositionCommand,
  isSessionRequestPayload,
  MAX_COMMANDS_PER_ROUND,
  normalizeDirection,
  parseCommand,
  POSITION_COMMANDS_PER_SECOND,
  PROGRAMMING_FUNDAMENTALS_V1,
  PROTOCOL_VERSION,
  resolveBoltAttack,
  startingShieldForScore,
  standingsFor,
  validateQuizTemplate,
  validatePosition,
  WEAPONS,
  type CommandName,
  type ClientEventName,
  type ClientEventPayloads,
  type ErrorCode,
  type ServerEventName,
  type ServerEventPayloads,
  type PlayerId,
  type Standing,
  type ValidatedCommand
} from "@codexwars/shared";
import { BattleState, PlayerState, StandingState, WarRoomState } from "./state.js";
import { type CommandOutcome, type ParticipantMember, WarRoomMembership } from "./membership.js";
import { QuizRun } from "./quiz-run.js";
import { RoomIdAllocator, type PresenceSet } from "./room-id.js";

interface JoinAuth {
  readonly displayName: string;
}

interface CombatBlocker {
  readonly playerId: string;
  readonly reason: string;
}

export interface WarRoomDependencies {
  readonly createRoomIdAllocator: (presence: PresenceSet) => RoomIdAllocator;
  readonly log: (entry: RedactedLogEntry) => void;
  readonly now: () => number;
  readonly reconnectGraceMs: (configuredGraceMs: number) => number;
}

export interface RedactedLogEntry {
  readonly correlationId: string;
  readonly errorCode: ErrorCode;
  readonly eventType: "server_error";
  readonly playerId: string;
  readonly roomIdHash: string;
}

const productionDependencies: WarRoomDependencies = {
  createRoomIdAllocator: (presence) => new RoomIdAllocator(presence),
  log: (entry) => console.info(JSON.stringify(entry)),
  now: () => Date.now(),
  reconnectGraceMs: (configuredGraceMs) => configuredGraceMs
};

let dependencies: WarRoomDependencies = productionDependencies;

export function setWarRoomDependenciesForTest(overrides: Partial<WarRoomDependencies>): () => void {
  const previous = dependencies;
  dependencies = { ...productionDependencies, ...overrides };
  return () => {
    dependencies = previous;
  };
}

function normalizeDisplayName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (normalized.length === 0 || [...normalized].length > 20 || /[\p{Cc}\p{Cf}]/u.test(normalized)) return undefined;
  return normalized;
}

function isJoinOptions(value: unknown): value is { readonly displayName: unknown; readonly protocolVersion: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).every((key) => key === "displayName" || key === "protocolVersion") && "displayName" in value && "protocolVersion" in value;
}

function positionOf(player: PlayerState): { readonly x: number; readonly z: number } | undefined {
  return player.positionLocked ? { x: player.positionX, z: player.positionZ } : undefined;
}

export class WarRoom extends Room<{ state: WarRoomState; client: Client }> {
  declare state: WarRoomState;

  private codeAllocated = false;
  private membership!: WarRoomMembership;
  private roomIdAllocator: RoomIdAllocator | undefined;
  private quizRun!: QuizRun;
  private lastSuccessfulActivityAt = 0;

  async onCreate(): Promise<void> {
    this.autoDispose = false;
    this.maxClients = ARENA.MAX_PARTICIPANTS + 1;
    this.patchRate = 100;
    this.setState(new WarRoomState());
    this.membership = new WarRoomMembership(this.state);
    this.quizRun = new QuizRun(this.state, {
      participantEvent: (playerId, type, payload) => this.sendToPlayer(playerId, type, payload),
      roomEvent: (type, payload) => this.emitEvent(type, payload)
    });
    const templateValidation = validateQuizTemplate(PROGRAMMING_FUNDAMENTALS_V1);
    if (!templateValidation.ok) throw new Error(`Invalid P0 quiz template: ${templateValidation.reason}`);
    this.state.serverNow = this.now();
    this.lastSuccessfulActivityAt = this.state.serverNow;
    await this.allocateRoomId();
    this.state.roomId = this.roomId;

    for (const name of COMMAND_NAMES) this.onMessage(name, (client, payload) => this.handleMessage(client, name, payload));
    this.onMessage("request_session", (client, payload) => this.handleSessionRequest(client, payload));

    this.clock.setInterval(() => this.advanceTimers(), 100);
  }

  onAuth(_client: Client, options: unknown): JoinAuth {
    if (!isJoinOptions(options) || options.protocolVersion !== PROTOCOL_VERSION) {
      throw new Error("CLIENT_VERSION_UNSUPPORTED");
    }
    const displayName = normalizeDisplayName(options.displayName);
    if (displayName === undefined) throw new Error("NICKNAME_INVALID");
    if (this.membership.hasOrganizer && this.state.players.size >= ARENA.MAX_PARTICIPANTS) {
      throw new Error("ROOM_FULL");
    }
    if (this.membership.hasOrganizer && this.state.phase !== "lobby") throw new Error("ROOM_NOT_JOINABLE");
    return { displayName };
  }

  onJoin(client: Client, _options: unknown, auth: JoinAuth): void {
    this.membership.join(client.sessionId, auth.displayName);
    this.touch();
  }

  onDrop(client: Client): void {
    const member = this.membership.drop(client.sessionId, this.now());
    if (member?.kind === "organizer") {
      this.allowOrganizerReconnection(client);
      return;
    }
    if (member?.kind === "participant") this.allowParticipantReconnection(client, member.playerId);
  }

  onReconnect(client: Client): void {
    if (this.membership.reconnect(client.sessionId) !== undefined) this.touch();
  }

  onLeave(client: Client): void {
    if (this.membership.leaveConnectedOrganizer(client.sessionId)) {
      this.disconnect();
      return;
    }
    const departure = this.membership.leaveConnectedParticipant(client.sessionId, this.now());
    if (departure?.disposition === "removed") this.quizRun.removeParticipant(departure.participant.playerId);
    if (departure?.disposition === "retained") this.transitionToPositioningWhenLocalized();
    if (departure?.disposition === "eliminated") {
      this.emitEvent("player_eliminated", { eliminatedByPlayerId: null, playerId: departure.participant.playerId });
      this.completeIfLastAlive();
    }
  }

  async onDispose(): Promise<void> {
    if (this.codeAllocated) await this.roomIdAllocator?.release(this.roomId);
  }

  onBeforePatch(): void {
    const now = this.now();
    this.state.serverNow = now;
    if (now - this.lastSuccessfulActivityAt >= BATTLE.IDLE_EXPIRY_MS) this.disconnect();
    if (!isPublicRoomStateProjection(this.state.toJSON())) throw new TypeError("Invalid public room state projection");
  }

  private now(): number {
    return dependencies.now();
  }

  private async allocateRoomId(): Promise<void> {
    this.roomIdAllocator = dependencies.createRoomIdAllocator(this.presence);
    this.roomId = await this.roomIdAllocator.allocate();
    this.codeAllocated = true;
  }

  private handleMessage(client: Client, name: CommandName, rawPayload: unknown): void {
    const parsed = parseCommand(name, rawPayload);
    const member = this.membership.memberForSession(client.sessionId);
    const participant = member?.kind === "participant" ? member : undefined;
    const isOrganizer = member?.kind === "organizer";
    if (member === undefined) {
      this.error(client, "SESSION_EXPIRED");
      return;
    }
    const now = this.now();
    if (parsed.ok === false) {
      const malformedAllowed = name !== "quiz_answer" || participant === undefined || this.quizRun.recordMalformedAttempt(participant.playerId);
      this.error(client, malformedAllowed ? parsed.code : "RATE_LIMITED");
      return;
    }
    const command = parsed.value;
    if (command.roundId !== this.state.roundId) {
      this.error(client, "ROUND_MISMATCH", command.commandId);
      return;
    }
    const outcomes = member.commandOutcomes;
    const duplicate = outcomes.get(command.commandId);
    if (duplicate !== undefined) {
      this.sendClientEvent(client, "command_accepted", duplicate);
      return;
    }
    if (!this.withinRawRate(participant, name, now)) {
      this.error(client, "RATE_LIMITED", command.commandId);
      return;
    }
    if (outcomes.size >= MAX_COMMANDS_PER_ROUND) {
      this.error(client, "RATE_LIMITED", command.commandId);
      return;
    }
    if (!this.authorizedForCommand(isOrganizer, command)) {
      this.error(client, "ROLE_FORBIDDEN", command.commandId);
      return;
    }

    const accepted = this.applyCommand(client, participant, command, now);
    if (!accepted) return;
    const outcome: CommandOutcome = { command: name, commandId: command.commandId, roundId: this.state.roundId, serverNow: now };
    if (command.command !== "reset_round") outcomes.set(command.commandId, outcome);
    this.sendClientEvent(client, "command_accepted", outcome);
    this.touch();
  }

  private handleSessionRequest(client: Client, payload: unknown): void {
    if (!isSessionRequestPayload(payload)) {
      this.error(client, "CLIENT_VERSION_UNSUPPORTED");
      return;
    }
    const member = this.membership.memberForSession(client.sessionId);
    if (member?.kind === "organizer") {
      this.sendClientEvent(client, "session_ready", { playerId: null, role: "organizer" });
      return;
    }
    if (member?.kind !== "participant") {
      this.error(client, "SESSION_EXPIRED");
      return;
    }
    this.sendClientEvent(client, "session_ready", { playerId: member.playerId, role: "participant" });
  }

  private authorizedForCommand(isOrganizer: boolean, command: ValidatedCommand): boolean {
    return isOrganizerCommand(command.command) ? isOrganizer && this.state.organizer.connected : !isOrganizer;
  }

  private applyCommand(client: Client, actor: ParticipantMember | undefined, command: ValidatedCommand, now: number): boolean {
    switch (command.command) {
      case "set_combat_included":
        return this.setCombatIncluded(client, command);
      case "configure_arena":
        return this.configureArena(client, command);
      case "select_quiz_template":
        return this.selectTemplate(client);
      case "start_quiz":
        return this.startQuiz(client, now);
      case "start_battle":
        return this.startBattle(client, now);
      case "reset_round":
        return this.resetRound(client);
      case "select_character":
        return actor !== undefined && this.selectCharacter(client, actor, command);
      case "quiz_answer":
        return actor !== undefined && this.submitQuizAnswer(client, actor, command, now);
      case "localization_changed":
        return actor !== undefined && this.changeLocalization(client, actor, command);
      case "lock_position":
        return actor !== undefined && this.lockPosition(client, actor, command);
      case "unlock_position":
        return actor !== undefined && this.unlockPosition(client, actor);
      case "ready_changed":
        return actor !== undefined && this.changeReady(client, actor, command);
      case "attack":
        return actor !== undefined && this.attack(client, actor, command, now);
    }
  }

  private setCombatIncluded(client: Client, command: Extract<ValidatedCommand, { command: "set_combat_included" }>): boolean {
    if (this.state.phase !== "lobby") return this.rejectPhase(client, command.commandId);
    const target = this.state.players.get(command.playerId);
    if (target === undefined) return this.reject(client, "ROLE_FORBIDDEN", command.commandId);
    target.combatIncluded = command.included;
    if (!command.included) this.clearPreBattleState(target);
    return true;
  }

  private selectCharacter(client: Client, actor: ParticipantMember, command: Extract<ValidatedCommand, { command: "select_character" }>): boolean {
    const player = this.state.players.get(actor.playerId);
    if (player === undefined) return this.reject(client, "SESSION_EXPIRED", command.commandId);
    if (this.state.phase !== "lobby" && this.state.phase !== "quiz" && this.state.phase !== "localization") {
      return this.rejectPhase(client, command.commandId);
    }
    player.characterId = command.characterId;
    player.characterColorId = command.colorId;
    return true;
  }

  private configureArena(client: Client, command: Extract<ValidatedCommand, { command: "configure_arena" }>): boolean {
    if (!this.canConfigureArena()) return this.rejectPhase(client, command.commandId);
    if (command.radiusM < ARENA.MIN_RADIUS_M || command.radiusM > ARENA.MAX_RADIUS_M) return this.reject(client, "ARENA_RADIUS_INVALID", command.commandId);
    this.state.arena.radiusM = command.radiusM;
    this.state.arena.configured = true;
    return true;
  }

  private selectTemplate(client: Client): boolean {
    if (!this.quizRun.selectTemplate()) return this.rejectPhase(client);
    return true;
  }

  private startQuiz(client: Client, now: number): boolean {
    if (!this.quizRun.start(now)) return this.reject(client, "QUIZ_NOT_READY");
    return true;
  }

  private submitQuizAnswer(client: Client, actor: ParticipantMember, command: Extract<ValidatedCommand, { command: "quiz_answer" }>, now: number): boolean {
    const submission = this.quizRun.submit(actor.playerId, command, now);
    return submission.ok || this.reject(client, submission.code, command.commandId);
  }

  private changeLocalization(client: Client, actor: ParticipantMember, command: Extract<ValidatedCommand, { command: "localization_changed" }>): boolean {
    const player = this.state.players.get(actor.playerId);
    const phaseAllowed = this.state.phase === "localization" || this.state.phase === "positioning" || this.state.phase === "countdown" || this.state.phase === "battle";
    if (player === undefined || !player.combatIncluded) return this.reject(client, "ROLE_FORBIDDEN", command.commandId);
    if (!phaseAllowed) return this.rejectPhase(client, command.commandId);
    player.localization = command.state;
    if (command.state === "lost" && this.state.phase !== "countdown" && this.state.phase !== "battle") player.ready = false;
    this.transitionToPositioningWhenLocalized();
    return true;
  }

  private lockPosition(client: Client, actor: ParticipantMember, command: Extract<ValidatedCommand, { command: "lock_position" }>): boolean {
    const player = this.state.players.get(actor.playerId);
    if (this.state.phase !== "positioning") return this.rejectPhase(client, command.commandId);
    if (player === undefined || !player.combatIncluded) return this.reject(client, "ROLE_FORBIDDEN", command.commandId);
    if (player.localization !== "localized") return this.reject(client, "NOT_LOCALIZED", command.commandId);
    const locked = [...this.state.players.values()]
      .filter((candidate) => candidate.playerId !== player.playerId && candidate.combatIncluded && candidate.positionLocked)
      .map((candidate) => this.combatant(candidate));
    const validation = validatePosition({ x: command.x, z: command.z }, this.state.arena.radiusM, locked);
    if (!validation.ok) return this.reject(client, validation.reason, command.commandId, { correction: validation.correction, distanceM: validation.distanceM, ...(validation.conflictsWithPlayerId === undefined ? {} : { conflictsWithPlayerId: validation.conflictsWithPlayerId }) });
    player.positionX = command.x;
    player.positionZ = command.z;
    player.positionLocked = true;
    return true;
  }

  private unlockPosition(client: Client, actor: ParticipantMember): boolean {
    const player = this.state.players.get(actor.playerId);
    if (this.state.phase !== "positioning") return this.rejectPhase(client);
    if (player === undefined || !player.combatIncluded) return this.reject(client, "ROLE_FORBIDDEN");
    player.positionLocked = false;
    player.ready = false;
    player.positionX = 0;
    player.positionZ = 0;
    return true;
  }

  private changeReady(client: Client, actor: ParticipantMember, command: Extract<ValidatedCommand, { command: "ready_changed" }>): boolean {
    const player = this.state.players.get(actor.playerId);
    if (this.state.phase !== "positioning") return this.rejectPhase(client, command.commandId);
    if (player === undefined || !player.combatIncluded) return this.reject(client, "ROLE_FORBIDDEN", command.commandId);
    if (command.ready && (!player.quizCompleted || player.localization !== "localized" || !player.positionLocked)) return this.reject(client, "NOT_LOCALIZED", command.commandId);
    player.ready = command.ready;
    return true;
  }

  private startBattle(client: Client, now: number): boolean {
    if (this.state.phase !== "positioning") return this.rejectPhase(client);
    const combatPlayers = [...this.state.players.values()].filter((player) => player.combatIncluded);
    const blockers: CombatBlocker[] = combatPlayers.flatMap((player) => this.startBlockers(player));
    if (combatPlayers.length < 2) blockers.push({ playerId: "room", reason: "MINIMUM_COMBATANTS" });
    if (blockers.length > 0) return this.reject(client, "BATTLE_START_BLOCKED", undefined, { blockers });
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
    this.emitEvent("battle_countdown_started", { endsAt: this.state.battle.endsAt, startsAt: this.state.battle.startsAt });
    return true;
  }

  private attack(client: Client, actor: ParticipantMember, command: Extract<ValidatedCommand, { command: "attack" }>, now: number): boolean {
    const attacker = this.state.players.get(actor.playerId);
    if (!this.canAttack(attacker, now)) return this.reject(client, "ATTACK_NOT_ALLOWED", command.commandId);
    const direction = normalizeDirection(command.dirX, command.dirZ);
    if (!direction.ok) return this.reject(client, "ATTACK_DIRECTION_INVALID", command.commandId);
    if (now < attacker.nextAttackAt) return this.reject(client, "ATTACK_COOLDOWN", command.commandId);
    attacker.nextAttackAt = now + WEAPONS.bolt.cooldownMs;
    const resolution = resolveBoltAttack(this.combatant(attacker), [...this.state.players.values()].filter((player) => player.playerId !== attacker.playerId).map((player) => this.combatant(player)), direction.direction);
    if (resolution.target === undefined) {
      this.emitEvent("attack_resolved", {
        attackerId: attacker.playerId,
        commandId: command.commandId,
        damage: 0,
        targetHp: null,
        targetId: null,
        targetShield: null
      });
      this.completeIfLastAlive();
      return true;
    }

    const target = this.state.players.get(resolution.target.playerId)!;
    const damage = this.applyBoltDamage(target);
    this.emitEvent("attack_resolved", {
      attackerId: attacker.playerId,
      commandId: command.commandId,
      damage,
      targetHp: target.hp,
      targetId: target.playerId,
      targetShield: target.shield
    });
    if (target.eliminated) this.emitEvent("player_eliminated", { eliminatedByPlayerId: attacker.playerId, playerId: target.playerId });
    this.completeIfLastAlive();
    return true;
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

  private canConfigureArena(): boolean {
    if (this.state.phase === "lobby" || this.state.phase === "quiz" || this.state.phase === "localization") return true;
    if (this.state.phase !== "positioning") return false;
    return ![...this.state.players.values()].some((player) => player.positionLocked);
  }

  private resetRound(client: Client): boolean {
    if (this.state.phase !== "results") return this.rejectPhase(client);
    this.state.roundId += 1;
    this.state.eventSequence = 0;
    this.state.phase = "lobby";
    this.quizRun.reset();
    this.state.battle = new BattleState();
    this.membership.clearCommandOutcomes();
    this.membership.removeDisconnectedParticipants();
    for (const player of this.state.players.values()) {
      this.clearPreBattleState(player);
      player.characterColorId = "gold";
      player.characterId = "default";
      player.combatIncluded = true;
      player.quizCompleted = false;
      player.correctAnswers = 0;
    }
    return true;
  }

  private advanceTimers(): void {
    const now = this.now();
    this.state.serverNow = now;
    this.quizRun.advance(now);
    this.transitionToPositioningWhenLocalized();
    if (this.state.phase === "countdown" && now >= this.state.battle.startsAt) {
      this.state.phase = "battle";
      this.state.battle.status = "active";
    }
    if (this.state.phase === "battle" && now >= this.state.battle.endsAt) this.finishBattle("timer");
  }

  private transitionToPositioningWhenLocalized(): void {
    if (this.state.phase !== "localization") return;
    const combatPlayers = [...this.state.players.values()].filter((player) => player.combatIncluded);
    if (this.state.arena.configured && combatPlayers.every((player) => player.localization === "localized")) this.state.phase = "positioning";
  }

  private startBlockers(player: PlayerState): readonly CombatBlocker[] {
    const blockers: CombatBlocker[] = [];
    if (!player.connected) blockers.push({ playerId: player.playerId, reason: "DISCONNECTED" });
    if (!player.quizCompleted) blockers.push({ playerId: player.playerId, reason: "QUIZ_INCOMPLETE" });
    if (player.localization !== "localized") blockers.push({ playerId: player.playerId, reason: "NOT_LOCALIZED" });
    if (!player.positionLocked) blockers.push({ playerId: player.playerId, reason: "POSITION_UNLOCKED" });
    if (!player.ready) blockers.push({ playerId: player.playerId, reason: "NOT_READY" });
    if (player.eliminated) blockers.push({ playerId: player.playerId, reason: "ELIMINATED" });
    return blockers;
  }

  private combatant(player: PlayerState) {
    return {
      combatIncluded: player.combatIncluded,
      connected: player.connected,
      correctAnswers: player.correctAnswers,
      displayName: player.displayName,
      eliminated: player.eliminated,
      hp: player.hp,
      playerId: player.playerId,
      position: positionOf(player),
      shield: player.shield
    };
  }

  private applyBoltDamage(target: PlayerState): number {
    const result = applyDamage(target.hp, target.shield, WEAPONS.bolt.damage);
    target.shield = result.shield;
    target.hp = result.hp;
    target.eliminated = result.eliminated;
    return WEAPONS.bolt.damage;
  }

  private completeIfLastAlive(): void {
    const alive = [...this.state.players.values()].filter((player) => player.combatIncluded && !player.eliminated);
    if (alive.length <= 1) this.finishBattle("last_alive");
  }

  private finishBattle(reason: "last_alive" | "timer"): void {
    if (this.state.battle.status === "completed") return;
    const standings = standingsFor([...this.state.players.values()].filter((player) => player.combatIncluded).map((player) => this.combatant(player)));
    const winner = standings[0];
    this.state.phase = "results";
    this.state.battle.status = "completed";
    this.state.battle.completionReason = reason;
    this.state.battle.winnerId = winner?.playerId ?? "";
    const stateStandings = new ArraySchema<StandingState>();
    for (const standing of standings) stateStandings.push(this.toStandingState(standing));
    this.state.battle.standings = stateStandings;
    this.emitEvent("battle_completed", { reason, standings, winnerId: this.state.battle.winnerId });
  }

  private allowParticipantReconnection(client: Client, playerId: PlayerId): void {
    this.allowReconnection(client, dependencies.reconnectGraceMs(BATTLE.DISCONNECT_ELIMINATION_MS) / 1_000)
      .catch(() => {
        const disposition = this.membership.participantReconnectExpired(playerId);
        if (disposition === "excluded") this.transitionToPositioningWhenLocalized();
        if (disposition === "eliminated") {
          this.emitEvent("player_eliminated", { eliminatedByPlayerId: null, playerId });
          this.completeIfLastAlive();
        }
      });
  }

  private allowOrganizerReconnection(client: Client): void {
    const policy = this.membership.organizerReconnectPolicy();
    const reconnection = this.allowReconnection(client, dependencies.reconnectGraceMs(policy.graceMs) / 1_000);
    if (policy.closeRoomOnExpiry) reconnection.catch(() => this.disconnect());
    else reconnection.catch(() => undefined);
  }

  private withinRawRate(actor: ParticipantMember | undefined, name: CommandName, now: number): boolean {
    if (actor === undefined) return true;
    let bucket: number[];
    let cap: number;
    if (name === "attack") {
      bucket = actor.recentAttackAttempts;
      cap = ATTACK_COMMANDS_PER_SECOND;
    } else if (isPositionCommand(name)) {
      bucket = actor.recentPositionAttempts;
      cap = POSITION_COMMANDS_PER_SECOND;
    } else {
      return true;
    }
    while (bucket.length > 0 && bucket[0] <= now - 1_000) bucket.shift();
    if (bucket.length >= cap) return false;
    bucket.push(now);
    return true;
  }

  private clearPreBattleState(player: PlayerState): void {
    player.hasAnsweredCurrent = false;
    player.localization = "not_started";
    player.positionLocked = false;
    player.positionX = 0;
    player.positionZ = 0;
    player.ready = false;
    player.maxHp = BATTLE.START_HP;
    player.hp = BATTLE.START_HP;
    player.shield = 0;
    player.charges = WEAPONS.bolt.charges;
    player.nextAttackAt = 0;
    player.eliminated = false;
    player.disconnectedAt = 0;
  }

  private toStandingState(standing: Standing): StandingState {
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

  private emitEvent<Name extends ServerEventName>(type: Name, payload: ServerEventPayloads[Name]): void {
    this.state.eventSequence += 1;
    this.broadcast(type, { ...payload, eventSequence: this.state.eventSequence, roundId: this.state.roundId, serverNow: this.now() });
  }

  private sendToPlayer<Name extends Exclude<ClientEventName, "command_accepted" | "server_error">>(playerId: PlayerId, type: Name, payload: ClientEventPayloads[Name]): void {
    const sessionId = this.membership.sessionIdForPlayer(playerId);
    const client = sessionId === undefined ? undefined : this.clients.find((candidate) => candidate.sessionId === sessionId);
    if (client !== undefined) this.sendClientEvent(client, type, payload);
  }

  private sendClientEvent<Name extends ClientEventName>(client: Client, type: Name, payload: ClientEventPayloads[Name]): void {
    client.send(type, payload);
  }

  private touch(): void {
    this.lastSuccessfulActivityAt = this.now();
    this.state.serverNow = this.lastSuccessfulActivityAt;
  }

  private rejectPhase(client: Client, commandId?: string): false {
    return this.reject(client, "PHASE_MISMATCH", commandId);
  }

  private reject(client: Client, code: ErrorCode, commandId?: string, details?: Record<string, unknown>): false {
    this.error(client, code, commandId, details);
    return false;
  }

  private error(client: Client, code: ErrorCode, commandId?: string, details?: Record<string, unknown>): void {
    const member = this.membership.memberForSession(client.sessionId);
    dependencies.log({
      correlationId: commandId ?? "",
      errorCode: code,
      eventType: "server_error",
      playerId: member?.kind === "participant" ? member.playerId : "",
      roomIdHash: createHash("sha256").update(this.roomId).digest("hex").slice(0, 16)
    });
    this.sendClientEvent(client, "server_error", {
      code,
      message: code.replace(/_/gu, " ").toLowerCase(),
      retryable: code === "RATE_LIMITED" || code === "ATTACK_COOLDOWN" || code === "BATTLE_START_BLOCKED",
      roundId: this.state.roundId,
      ...(commandId === undefined ? {} : { commandId }),
      ...(details === undefined ? {} : { details })
    });
  }
}
