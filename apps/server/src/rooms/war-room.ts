import { ArraySchema } from "@colyseus/schema";
import { createHash } from "node:crypto";
import { Client, Room } from "colyseus";
import {
  ARENA,
  applyDamage,
  ATTACK_COMMANDS_PER_SECOND,
  BATTLE,
  isClientEventPayload,
  isPublicRoomStateProjection,
  MAX_COMMANDS_PER_ROUND,
  MAX_MALFORMED_QUIZ_ATTEMPTS,
  normalizeDirection,
  isServerEventPayload,
  parseCommand,
  POSITION_COMMANDS_PER_SECOND,
  PROGRAMMING_FUNDAMENTALS_V1,
  PROTOCOL_VERSION,
  publicQuizQuestion,
  QUIZ,
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
import { BattleState, PlayerState, QuizOptionState, QuizQuestionState, QuizState, StandingState, WarRoomState } from "./state.js";
import { RoomIdAllocator, type PresenceSet } from "./room-id.js";

interface JoinAuth {
  readonly displayName: string;
}

interface PrivatePlayer {
  readonly answers: Map<string, string>;
  readonly commandOutcomes: Map<string, CommandOutcome>;
  readonly malformedQuizAttempts: Map<string, number>;
  readonly playerId: PlayerId;
  readonly recentAttackAttempts: number[];
  readonly recentPositionAttempts: number[];
  sessionId: string;
}

interface CommandOutcome {
  readonly command: CommandName;
  readonly commandId: string;
  readonly serverNow: number;
}

interface OrganizerPrivateState {
  readonly commandOutcomes: Map<string, CommandOutcome>;
  sessionId: string;
}

interface CombatBlocker {
  readonly playerId: string;
  readonly reason: string;
}

export interface WarRoomDependencies {
  readonly createRoomIdAllocator: (presence: PresenceSet) => RoomIdAllocator;
  readonly log: (entry: RedactedLogEntry) => void;
  readonly now: () => number;
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
  now: () => Date.now()
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
  private roomIdAllocator: RoomIdAllocator | undefined;
  private organizer: OrganizerPrivateState | undefined;
  private readonly playersById = new Map<PlayerId, PrivatePlayer>();
  private readonly playerIdBySessionId = new Map<string, PlayerId>();
  private frozenCohort = new Set<PlayerId>();
  private lastSuccessfulActivityAt = 0;
  private nextPlayerId = 1;

  async onCreate(): Promise<void> {
    this.autoDispose = false;
    this.maxClients = ARENA.MAX_PARTICIPANTS + 1;
    this.patchRate = 100;
    this.setState(new WarRoomState());
    const templateValidation = validateQuizTemplate(PROGRAMMING_FUNDAMENTALS_V1);
    if (!templateValidation.ok) throw new Error(`Invalid P0 quiz template: ${templateValidation.reason}`);
    this.state.serverNow = this.now();
    this.lastSuccessfulActivityAt = this.state.serverNow;
    await this.allocateRoomId();
    this.state.roomId = this.roomId;

    this.onMessage("set_combat_included", (client, payload) => this.handleMessage(client, "set_combat_included", payload));
    this.onMessage("configure_arena", (client, payload) => this.handleMessage(client, "configure_arena", payload));
    this.onMessage("select_quiz_template", (client, payload) => this.handleMessage(client, "select_quiz_template", payload));
    this.onMessage("start_quiz", (client, payload) => this.handleMessage(client, "start_quiz", payload));
    this.onMessage("start_battle", (client, payload) => this.handleMessage(client, "start_battle", payload));
    this.onMessage("reset_round", (client, payload) => this.handleMessage(client, "reset_round", payload));
    this.onMessage("quiz_answer", (client, payload) => this.handleMessage(client, "quiz_answer", payload));
    this.onMessage("localization_changed", (client, payload) => this.handleMessage(client, "localization_changed", payload));
    this.onMessage("lock_position", (client, payload) => this.handleMessage(client, "lock_position", payload));
    this.onMessage("unlock_position", (client, payload) => this.handleMessage(client, "unlock_position", payload));
    this.onMessage("ready_changed", (client, payload) => this.handleMessage(client, "ready_changed", payload));
    this.onMessage("attack", (client, payload) => this.handleMessage(client, "attack", payload));

    this.clock.setInterval(() => this.advanceTimers(), 100);
  }

  onAuth(_client: Client, options: unknown): JoinAuth {
    if (!isJoinOptions(options) || options.protocolVersion !== PROTOCOL_VERSION) {
      throw new Error("CLIENT_VERSION_UNSUPPORTED");
    }
    const displayName = normalizeDisplayName(options.displayName);
    if (displayName === undefined) throw new Error("NICKNAME_INVALID");
    if (this.organizer !== undefined && this.state.players.size >= ARENA.MAX_PARTICIPANTS) {
      throw new Error("ROOM_FULL");
    }
    if (this.organizer !== undefined && this.state.phase !== "lobby") throw new Error("ROOM_NOT_JOINABLE");
    return { displayName };
  }

  onJoin(client: Client, _options: unknown, auth: JoinAuth): void {
    if (this.organizer === undefined) {
      this.organizer = { commandOutcomes: new Map(), sessionId: client.sessionId };
      this.state.organizer.connected = true;
      this.state.organizer.displayName = auth.displayName;
      this.touch();
      return;
    }

    const existingPlayerId = this.playerIdBySessionId.get(client.sessionId);
    if (existingPlayerId !== undefined) {
      const existing = this.state.players.get(existingPlayerId);
      if (existing !== undefined) existing.connected = true;
      this.touch();
      return;
    }

    const playerId = `player-${this.nextPlayerId++}`;
    const publicPlayer = this.newPlayerState(playerId, this.uniqueDisplayName(auth.displayName));
    this.state.players.set(playerId, publicPlayer);
    this.playersById.set(playerId, {
      answers: new Map(),
      commandOutcomes: new Map(),
      malformedQuizAttempts: new Map(),
      playerId,
      recentAttackAttempts: [],
      recentPositionAttempts: [],
      sessionId: client.sessionId
    });
    this.playerIdBySessionId.set(client.sessionId, playerId);
    this.touch();
  }

  onDrop(client: Client): void {
    if (this.organizer?.sessionId === client.sessionId) {
      this.state.organizer.connected = false;
      this.allowOrganizerReconnection(client);
      return;
    }
    const playerId = this.playerIdBySessionId.get(client.sessionId);
    const player = playerId === undefined ? undefined : this.state.players.get(playerId);
    if (playerId === undefined || player === undefined) return;
    player.connected = false;
    player.disconnectedAt = this.now();
    if (this.state.phase !== "countdown" && this.state.phase !== "battle") player.ready = false;
    this.allowParticipantReconnection(client, playerId);
  }

  onReconnect(client: Client): void {
    if (this.organizer?.sessionId === client.sessionId) {
      this.state.organizer.connected = true;
      this.touch();
      return;
    }
    const playerId = this.playerIdBySessionId.get(client.sessionId);
    if (playerId === undefined) return;
    const player = this.state.players.get(playerId);
    const privatePlayer = this.playersById.get(playerId);
    if (player === undefined || privatePlayer === undefined) return;
    player.connected = true;
    player.disconnectedAt = 0;
    privatePlayer.sessionId = client.sessionId;
    this.touch();
  }

  onLeave(client: Client): void {
    if (this.organizer?.sessionId === client.sessionId && !this.state.organizer.connected) {
      this.disconnect();
      return;
    }
    const playerId = this.playerIdBySessionId.get(client.sessionId);
    const player = playerId === undefined ? undefined : this.state.players.get(playerId);
    if (playerId === undefined || player === undefined || !player.connected) return;
    this.state.players.delete(playerId);
    this.playersById.delete(playerId);
    this.playerIdBySessionId.delete(client.sessionId);
  }

  async onDispose(): Promise<void> {
    if (this.codeAllocated) await this.roomIdAllocator?.release(this.roomId);
  }

  onBeforePatch(): void {
    this.state.serverNow = this.now();
    if (this.now() - this.lastSuccessfulActivityAt >= BATTLE.IDLE_EXPIRY_MS) this.disconnect();
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

  private newPlayerState(playerId: PlayerId, displayName: string): PlayerState {
    const player = new PlayerState();
    player.playerId = playerId;
    player.displayName = displayName;
    return player;
  }

  private uniqueDisplayName(baseName: string): string {
    const names = new Set([...this.state.players.values()].map((player) => player.displayName));
    if (!names.has(baseName)) return baseName;
    let suffix = 2;
    while (names.has(`${baseName} (${suffix})`)) suffix += 1;
    return `${baseName} (${suffix})`;
  }

  private handleMessage(client: Client, name: CommandName, rawPayload: unknown): void {
    const parsed = parseCommand(name, rawPayload);
    const playerId = this.playerIdBySessionId.get(client.sessionId);
    const privatePlayer = playerId === undefined ? undefined : this.playersById.get(playerId);
    const isOrganizer = this.organizer?.sessionId === client.sessionId;
    if (!isOrganizer && privatePlayer === undefined) {
      this.error(client, "SESSION_EXPIRED");
      return;
    }
    const now = this.now();
    if (parsed.ok === false) {
      const malformedAllowed = name !== "quiz_answer" || privatePlayer === undefined || this.recordMalformedQuizAttempt(privatePlayer);
      this.error(client, malformedAllowed ? parsed.code : "RATE_LIMITED");
      return;
    }
    const command = parsed.value;
    if (command.roundId !== this.state.roundId) {
      this.error(client, "ROUND_MISMATCH", command.commandId);
      return;
    }
    const outcomes = isOrganizer ? this.organizer?.commandOutcomes : privatePlayer?.commandOutcomes;
    if (outcomes === undefined) {
      this.error(client, "SESSION_EXPIRED", command.commandId);
      return;
    }
    const duplicate = outcomes.get(command.commandId);
    if (duplicate !== undefined) {
      this.sendClientEvent(client, "command_accepted", duplicate);
      return;
    }
    if (!this.withinRawRate(privatePlayer, name, now)) {
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

    const accepted = this.applyCommand(client, privatePlayer, command, now);
    if (!accepted) return;
    const outcome: CommandOutcome = { command: name, commandId: command.commandId, serverNow: now };
    if (command.command !== "reset_round") outcomes.set(command.commandId, outcome);
    this.sendClientEvent(client, "command_accepted", outcome);
    this.touch();
  }

  private authorizedForCommand(isOrganizer: boolean, command: ValidatedCommand): boolean {
    const organizerCommand = command.command === "set_combat_included" || command.command === "configure_arena" || command.command === "select_quiz_template" || command.command === "start_quiz" || command.command === "start_battle" || command.command === "reset_round";
    return organizerCommand ? isOrganizer && this.state.organizer.connected : !isOrganizer;
  }

  private applyCommand(client: Client, actor: PrivatePlayer | undefined, command: ValidatedCommand, now: number): boolean {
    switch (command.command) {
      case "set_combat_included": return this.setCombatIncluded(client, command);
      case "configure_arena": return this.configureArena(client, command);
      case "select_quiz_template": return this.selectTemplate(client);
      case "start_quiz": return this.startQuiz(client, now);
      case "start_battle": return this.startBattle(client, now);
      case "reset_round": return this.resetRound(client);
      case "quiz_answer": return actor !== undefined && this.submitQuizAnswer(client, actor, command, now);
      case "localization_changed": return actor !== undefined && this.changeLocalization(client, actor, command);
      case "lock_position": return actor !== undefined && this.lockPosition(client, actor, command);
      case "unlock_position": return actor !== undefined && this.unlockPosition(client, actor);
      case "ready_changed": return actor !== undefined && this.changeReady(client, actor, command);
      case "attack": return actor !== undefined && this.attack(client, actor, command, now);
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

  private configureArena(client: Client, command: Extract<ValidatedCommand, { command: "configure_arena" }>): boolean {
    const phaseAllowed = this.state.phase === "lobby" || this.state.phase === "quiz" || this.state.phase === "localization" || (this.state.phase === "positioning" && ![...this.state.players.values()].some((player) => player.positionLocked));
    if (!phaseAllowed) return this.rejectPhase(client, command.commandId);
    if (command.radiusM < ARENA.MIN_RADIUS_M || command.radiusM > ARENA.MAX_RADIUS_M) return this.reject(client, "ARENA_RADIUS_INVALID", command.commandId);
    this.state.arena.radiusM = command.radiusM;
    this.state.arena.configured = true;
    return true;
  }

  private selectTemplate(client: Client): boolean {
    if (this.state.phase !== "lobby") return this.rejectPhase(client);
    this.state.quiz.status = "ready";
    return true;
  }

  private startQuiz(client: Client, now: number): boolean {
    if (this.state.phase !== "lobby" || this.state.players.size === 0 || this.state.quiz.status !== "ready") return this.reject(client, "QUIZ_NOT_READY");
    this.frozenCohort = new Set(this.state.players.keys());
    this.state.quiz.eligibleCount = this.frozenCohort.size;
    this.state.phase = "quiz";
    this.startQuestion(0, now);
    return true;
  }

  private startQuestion(questionIndex: number, now: number): void {
    const question = PROGRAMMING_FUNDAMENTALS_V1.questions[questionIndex];
    if (question === undefined) {
      this.completeQuiz();
      return;
    }
    this.state.quiz.status = "question";
    this.state.quiz.questionIndex = questionIndex;
    this.state.quiz.questionEndsAt = now + question.durationMs;
    this.state.quiz.revealEndsAt = 0;
    this.state.quiz.revealedCorrectOptionId = "";
    this.state.quiz.revealedExplanation = "";
    this.state.quiz.submittedCount = 0;
    this.state.quiz.currentQuestion = this.toQuestionState(question);
    for (const playerId of this.frozenCohort) {
      const player = this.state.players.get(playerId);
      if (player !== undefined) player.hasAnsweredCurrent = false;
    }
    this.emitEvent("quiz_question_started", { questionEndsAt: this.state.quiz.questionEndsAt, questionId: question.id, questionIndex });
  }

  private submitQuizAnswer(client: Client, actor: PrivatePlayer, command: Extract<ValidatedCommand, { command: "quiz_answer" }>, now: number): boolean {
    const question = PROGRAMMING_FUNDAMENTALS_V1.questions[this.state.quiz.questionIndex];
    const player = this.state.players.get(actor.playerId);
    if (question === undefined || player === undefined || !this.frozenCohort.has(actor.playerId) || this.state.quiz.status !== "question") return this.rejectPhase(client, command.commandId);
    if (command.questionId !== question.id) return this.reject(client, "QUESTION_MISMATCH", command.commandId);
    if (!question.options.some((option) => option.id === command.optionId)) return this.reject(client, "ANSWER_OPTION_INVALID", command.commandId);
    if (now >= this.state.quiz.questionEndsAt) return this.reject(client, "ANSWER_LATE", command.commandId);
    if (actor.answers.has(question.id)) return this.reject(client, "ANSWER_DUPLICATE", command.commandId);
    actor.answers.set(question.id, command.optionId);
    player.hasAnsweredCurrent = true;
    this.state.quiz.submittedCount += 1;
    this.sendClientEvent(client, "quiz_answer_accepted", { acceptedAt: now, commandId: command.commandId, questionId: question.id, roundId: this.state.roundId });
    return true;
  }

  private changeLocalization(client: Client, actor: PrivatePlayer, command: Extract<ValidatedCommand, { command: "localization_changed" }>): boolean {
    const player = this.state.players.get(actor.playerId);
    const phaseAllowed = this.state.phase === "localization" || this.state.phase === "positioning" || this.state.phase === "countdown" || this.state.phase === "battle";
    if (player === undefined || !player.combatIncluded) return this.reject(client, "ROLE_FORBIDDEN", command.commandId);
    if (!phaseAllowed) return this.rejectPhase(client, command.commandId);
    player.localization = command.state;
    if (command.state === "lost" && this.state.phase !== "countdown" && this.state.phase !== "battle") player.ready = false;
    this.transitionToPositioningWhenLocalized();
    return true;
  }

  private lockPosition(client: Client, actor: PrivatePlayer, command: Extract<ValidatedCommand, { command: "lock_position" }>): boolean {
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

  private unlockPosition(client: Client, actor: PrivatePlayer): boolean {
    const player = this.state.players.get(actor.playerId);
    if (this.state.phase !== "positioning") return this.rejectPhase(client);
    if (player === undefined || !player.combatIncluded) return this.reject(client, "ROLE_FORBIDDEN");
    player.positionLocked = false;
    player.ready = false;
    player.positionX = 0;
    player.positionZ = 0;
    return true;
  }

  private changeReady(client: Client, actor: PrivatePlayer, command: Extract<ValidatedCommand, { command: "ready_changed" }>): boolean {
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

  private attack(client: Client, actor: PrivatePlayer, command: Extract<ValidatedCommand, { command: "attack" }>, now: number): boolean {
    const attacker = this.state.players.get(actor.playerId);
    if (this.state.phase !== "battle" || this.state.battle.status !== "active" || now < this.state.battle.startsAt || now >= this.state.battle.endsAt || attacker === undefined || !attacker.connected || !attacker.combatIncluded || attacker.eliminated || !attacker.positionLocked || attacker.localization === "lost") return this.reject(client, "ATTACK_NOT_ALLOWED", command.commandId);
    if (command.weaponId !== "bolt") return this.reject(client, "WEAPON_INVALID", command.commandId);
    const direction = normalizeDirection(command.dirX, command.dirZ);
    if (!direction.ok) return this.reject(client, "ATTACK_DIRECTION_INVALID", command.commandId);
    if (now < attacker.nextAttackAt) return this.reject(client, "ATTACK_COOLDOWN", command.commandId);
    attacker.nextAttackAt = now + WEAPONS.bolt.cooldownMs;
    const resolution = resolveBoltAttack(this.combatant(attacker), [...this.state.players.values()].filter((player) => player.playerId !== attacker.playerId).map((player) => this.combatant(player)), direction.direction);
    let targetId: string | null = null;
    let targetShield: number | null = null;
    let targetHp: number | null = null;
    if (resolution.target !== undefined) {
      const target = this.state.players.get(resolution.target.playerId);
      if (target !== undefined) {
        targetId = target.playerId;
        const damage = this.applyBoltDamage(target);
        targetShield = target.shield;
        targetHp = target.hp;
        this.emitEvent("attack_resolved", { attackerId: attacker.playerId, commandId: command.commandId, damage, targetHp, targetId, targetShield });
        if (target.eliminated) this.emitEvent("player_eliminated", { eliminatedByPlayerId: attacker.playerId, playerId: target.playerId });
      }
    }
    if (resolution.target === undefined) this.emitEvent("attack_resolved", { attackerId: attacker.playerId, commandId: command.commandId, damage: 0, targetHp, targetId, targetShield });
    this.completeIfLastAlive();
    return true;
  }

  private resetRound(client: Client): boolean {
    if (this.state.phase !== "results") return this.rejectPhase(client);
    this.state.roundId += 1;
    this.state.eventSequence = 0;
    this.state.phase = "lobby";
    this.state.quiz = new QuizState();
    this.state.battle = new BattleState();
    this.frozenCohort = new Set();
    this.organizer?.commandOutcomes.clear();
    for (const [playerId, player] of this.state.players) {
      this.clearPreBattleState(player);
      player.combatIncluded = true;
      player.quizCompleted = false;
      player.correctAnswers = 0;
      this.playersById.get(playerId)?.answers.clear();
      this.playersById.get(playerId)?.commandOutcomes.clear();
      this.playersById.get(playerId)?.malformedQuizAttempts.clear();
    }
    return true;
  }

  private advanceTimers(): void {
    const now = this.now();
    this.state.serverNow = now;
    if (this.state.phase === "quiz" && this.state.quiz.status === "question" && now >= this.state.quiz.questionEndsAt) this.revealQuestion(now);
    else if (this.state.phase === "quiz" && this.state.quiz.status === "reveal" && now >= this.state.quiz.revealEndsAt) this.startQuestion(this.state.quiz.questionIndex + 1, now);
    if (this.state.phase === "countdown" && now >= this.state.battle.startsAt) {
      this.state.phase = "battle";
      this.state.battle.status = "active";
    }
    if (this.state.phase === "battle" && now >= this.state.battle.endsAt) this.finishBattle("timer");
  }

  private revealQuestion(now: number): void {
    const question = PROGRAMMING_FUNDAMENTALS_V1.questions[this.state.quiz.questionIndex];
    if (question === undefined) return;
    this.state.quiz.status = "reveal";
    this.state.quiz.revealedCorrectOptionId = question.answerOptionId;
    this.state.quiz.revealedExplanation = question.explanation;
    this.state.quiz.revealEndsAt = now + QUIZ.REVEAL_MS;
    this.emitEvent("quiz_question_revealed", { correctOptionId: question.answerOptionId, explanation: question.explanation, questionId: question.id, revealEndsAt: this.state.quiz.revealEndsAt });
    for (const playerId of this.frozenCohort) {
      const privatePlayer = this.playersById.get(playerId);
      const player = this.state.players.get(playerId);
      if (privatePlayer === undefined || player === undefined) continue;
      const selectedOptionId = privatePlayer.answers.get(question.id);
      const correct = selectedOptionId === question.answerOptionId;
      if (correct) player.correctAnswers += 1;
      this.sendToPlayer(playerId, "quiz_answer_result", { correct, questionId: question.id, roundId: this.state.roundId, runningCorrectAnswers: player.correctAnswers, ...(selectedOptionId === undefined ? {} : { selectedOptionId }) });
    }
  }

  private completeQuiz(): void {
    this.state.quiz.status = "completed";
    this.state.phase = "localization";
    this.state.quiz.currentQuestion = new QuizQuestionState();
    for (const playerId of this.frozenCohort) {
      const player = this.state.players.get(playerId);
      if (player === undefined) continue;
      player.quizCompleted = true;
      player.shield = startingShieldForScore(player.correctAnswers);
      this.sendToPlayer(playerId, "quiz_completed", { correctAnswers: player.correctAnswers, questionCount: QUIZ.QUESTION_COUNT, roundId: this.state.roundId, startingShield: player.shield });
    }
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
    this.allowReconnection(client, BATTLE.DISCONNECT_ELIMINATION_MS / 1_000)
      .catch(() => {
        const player = this.state.players.get(playerId);
        if (player === undefined || player.connected || this.state.phase !== "countdown" && this.state.phase !== "battle") return;
        if (!player.eliminated) {
          player.hp = 0;
          player.eliminated = true;
          this.emitEvent("player_eliminated", { eliminatedByPlayerId: null, playerId });
          this.completeIfLastAlive();
        }
      });
  }

  private allowOrganizerReconnection(client: Client): void {
    if (this.state.phase === "countdown" || this.state.phase === "battle") {
      this.allowReconnection(client, BATTLE.DISCONNECT_ELIMINATION_MS / 1_000).catch(() => undefined);
      return;
    }
    this.allowReconnection(client, BATTLE.HOST_RECONNECT_GRACE_MS / 1_000).catch(() => this.disconnect());
  }

  private withinRawRate(actor: PrivatePlayer | undefined, name: CommandName, now: number): boolean {
    if (actor === undefined) return true;
    const bucket = name === "attack" ? actor.recentAttackAttempts : name === "localization_changed" || name === "lock_position" || name === "unlock_position" || name === "ready_changed" ? actor.recentPositionAttempts : undefined;
    if (bucket === undefined) return true;
    while (bucket.length > 0 && bucket[0] <= now - 1_000) bucket.shift();
    const cap = name === "attack" ? ATTACK_COMMANDS_PER_SECOND : POSITION_COMMANDS_PER_SECOND;
    if (bucket.length >= cap) return false;
    bucket.push(now);
    return true;
  }

  private recordMalformedQuizAttempt(actor: PrivatePlayer): boolean {
    const questionId = this.state.quiz.currentQuestion.id;
    if (questionId.length === 0) return true;
    const attempted = actor.malformedQuizAttempts.get(questionId) ?? 0;
    if (attempted >= MAX_MALFORMED_QUIZ_ATTEMPTS) return false;
    actor.malformedQuizAttempts.set(questionId, attempted + 1);
    return true;
  }

  private clearPreBattleState(player: PlayerState): void {
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

  private toQuestionState(question: ReturnType<typeof publicQuizQuestion>): QuizQuestionState {
    const state = new QuizQuestionState();
    state.id = question.id;
    state.order = question.order;
    state.prompt = question.prompt;
    state.difficulty = question.difficulty;
    state.durationMs = question.durationMs;
    const options = new ArraySchema<QuizOptionState>();
    for (const option of question.options) {
      const optionState = new QuizOptionState();
      optionState.id = option.id;
      optionState.label = option.label;
      options.push(optionState);
    }
    state.options = options;
    return state;
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
    if (!isServerEventPayload(type, payload)) throw new TypeError(`Invalid event payload: ${type}`);
    this.state.eventSequence += 1;
    this.broadcast(type, { ...payload, eventSequence: this.state.eventSequence, roundId: this.state.roundId, serverNow: this.now() });
  }

  private sendToPlayer<Name extends Exclude<ClientEventName, "command_accepted" | "server_error">>(playerId: PlayerId, type: Name, payload: ClientEventPayloads[Name]): void {
    const sessionId = this.playersById.get(playerId)?.sessionId;
    const client = sessionId === undefined ? undefined : this.clients.find((candidate) => candidate.sessionId === sessionId);
    if (client !== undefined) this.sendClientEvent(client, type, payload);
  }

  private sendClientEvent<Name extends ClientEventName>(client: Client, type: Name, payload: ClientEventPayloads[Name]): void {
    if (!isClientEventPayload(type, payload)) throw new TypeError(`Invalid client event payload: ${type}`);
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
    dependencies.log({
      correlationId: commandId ?? "",
      errorCode: code,
      eventType: "server_error",
      playerId: this.playerIdBySessionId.get(client.sessionId) ?? "",
      roomIdHash: createHash("sha256").update(this.roomId).digest("hex").slice(0, 16)
    });
    this.sendClientEvent(client, "server_error", { code, message: code.replace(/_/gu, " ").toLowerCase(), retryable: code === "RATE_LIMITED" || code === "ATTACK_COOLDOWN" || code === "BATTLE_START_BLOCKED", roundId: this.state?.roundId ?? 1, ...(commandId === undefined ? {} : { commandId }), ...(details === undefined ? {} : { details }) });
  }
}
