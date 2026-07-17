import { BATTLE, WEAPONS, type CommandName, type PlayerId } from "@codexwars/shared";
import { PlayerState, WarRoomState } from "./state.js";

export interface CommandOutcome {
  readonly command: CommandName;
  readonly commandId: string;
  readonly roundId: number;
  readonly serverNow: number;
}

export interface OrganizerMember {
  readonly commandOutcomes: Map<string, CommandOutcome>;
  readonly kind: "organizer";
  readonly sessionId: string;
}

export interface ParticipantMember {
  readonly commandOutcomes: Map<string, CommandOutcome>;
  readonly kind: "participant";
  readonly playerId: PlayerId;
  readonly recentAttackAttempts: number[];
  readonly recentPositionAttempts: number[];
  readonly sessionId: string;
}

export type WarRoomMember = OrganizerMember | ParticipantMember;

export interface ParticipantLeave {
  readonly disposition: "eliminated" | "removed" | "retained";
  readonly participant: ParticipantMember;
}

export type ReconnectExpiryDisposition = "eliminated" | "excluded";

export class WarRoomMembership {
  private readonly membersBySessionId = new Map<string, WarRoomMember>();
  private organizer: OrganizerMember | undefined;
  private readonly participantsById = new Map<PlayerId, ParticipantMember>();
  private nextPlayerId = 1;

  constructor(private readonly state: WarRoomState) {}

  get hasOrganizer(): boolean {
    return this.organizer !== undefined;
  }

  memberForSession(sessionId: string): WarRoomMember | undefined {
    return this.membersBySessionId.get(sessionId);
  }

  sessionIdForPlayer(playerId: PlayerId): string | undefined {
    return this.participantsById.get(playerId)?.sessionId;
  }

  setCombatIncluded(playerId: PlayerId, included: boolean): boolean {
    const player = this.state.players.get(playerId);
    if (player === undefined) return false;
    player.combatIncluded = included;
    if (!included) this.clearPreBattleState(player);
    return true;
  }

  join(sessionId: string, displayName: string): WarRoomMember {
    const existing = this.membersBySessionId.get(sessionId);
    if (existing !== undefined) {
      this.markConnected(existing);
      return existing;
    }

    if (this.organizer === undefined) {
      const organizer: OrganizerMember = { commandOutcomes: new Map(), kind: "organizer", sessionId };
      this.organizer = organizer;
      this.membersBySessionId.set(sessionId, organizer);
      this.state.organizer.connected = true;
      this.state.organizer.displayName = displayName;
      return organizer;
    }

    const playerId = `player-${this.nextPlayerId++}`;
    const participant: ParticipantMember = {
      commandOutcomes: new Map(),
      kind: "participant",
      playerId,
      recentAttackAttempts: [],
      recentPositionAttempts: [],
      sessionId
    };
    const publicPlayer = new PlayerState();
    publicPlayer.playerId = playerId;
    publicPlayer.displayName = this.uniqueDisplayName(displayName);
    this.state.players.set(playerId, publicPlayer);
    this.participantsById.set(playerId, participant);
    this.membersBySessionId.set(sessionId, participant);
    return participant;
  }

  drop(sessionId: string, now: number): WarRoomMember | undefined {
    const member = this.membersBySessionId.get(sessionId);
    if (member === undefined) return undefined;
    if (member.kind === "organizer") {
      this.state.organizer.connected = false;
      return member;
    }

    const player = this.state.players.get(member.playerId);
    if (player === undefined) return undefined;
    player.connected = false;
    player.disconnectedAt = now;
    if (this.state.phase !== "countdown" && this.state.phase !== "battle") player.ready = false;
    return member;
  }

  reconnect(sessionId: string): WarRoomMember | undefined {
    const member = this.membersBySessionId.get(sessionId);
    if (member === undefined) return undefined;
    this.markConnected(member);
    return member;
  }

  leaveConnectedOrganizer(sessionId: string): boolean {
    const member = this.membersBySessionId.get(sessionId);
    if (member?.kind !== "organizer" || !this.state.organizer.connected) return false;
    this.state.organizer.connected = false;
    return true;
  }

  leaveConnectedParticipant(sessionId: string, now: number): ParticipantLeave | undefined {
    const member = this.membersBySessionId.get(sessionId);
    if (member?.kind !== "participant") return undefined;
    const player = this.state.players.get(member.playerId);
    if (player === undefined || !player.connected) return undefined;
    if (this.state.phase === "quiz" || this.state.phase === "localization" || this.state.phase === "positioning") {
      player.connected = false;
      player.disconnectedAt = now;
      this.excludeFromCombat(player);
      return { disposition: "retained", participant: member };
    }
    if (this.state.phase === "countdown" || this.state.phase === "battle") {
      player.connected = false;
      player.disconnectedAt = now;
      if (player.eliminated) return { disposition: "retained", participant: member };
      player.hp = 0;
      player.eliminated = true;
      return { disposition: "eliminated", participant: member };
    }
    this.state.players.delete(member.playerId);
    this.participantsById.delete(member.playerId);
    this.membersBySessionId.delete(sessionId);
    return { disposition: "removed", participant: member };
  }

  clearCommandOutcomes(): void {
    this.organizer?.commandOutcomes.clear();
    for (const participant of this.participantsById.values()) participant.commandOutcomes.clear();
  }

  removeDisconnectedParticipants(): void {
    for (const [playerId, participant] of this.participantsById) {
      const player = this.state.players.get(playerId);
      if (player === undefined || player.connected) continue;
      this.state.players.delete(playerId);
      this.participantsById.delete(playerId);
      this.membersBySessionId.delete(participant.sessionId);
    }
  }

  resetRound(): void {
    this.clearCommandOutcomes();
    this.removeDisconnectedParticipants();
    for (const player of this.state.players.values()) {
      this.clearPreBattleState(player);
      player.characterColorId = "gold";
      player.characterId = "default";
      player.combatIncluded = true;
      player.quizCompleted = false;
      player.correctAnswers = 0;
    }
  }

  organizerReconnectPolicy(): { readonly closeRoomOnExpiry: boolean; readonly graceMs: number } {
    const activeBattle = this.state.phase === "countdown" || this.state.phase === "battle";
    return activeBattle
      ? { closeRoomOnExpiry: false, graceMs: BATTLE.DISCONNECT_ELIMINATION_MS }
      : { closeRoomOnExpiry: true, graceMs: BATTLE.HOST_RECONNECT_GRACE_MS };
  }

  participantReconnectExpired(playerId: PlayerId): ReconnectExpiryDisposition | undefined {
    const player = this.state.players.get(playerId);
    const activeBattle = this.state.phase === "countdown" || this.state.phase === "battle";
    if (player === undefined || player.connected) return undefined;
    if (activeBattle) {
      if (player.eliminated) return undefined;
      player.hp = 0;
      player.eliminated = true;
      return "eliminated";
    }
    if (this.state.phase === "results") return undefined;
    this.excludeFromCombat(player);
    return "excluded";
  }

  private clearPositioningState(player: PlayerState): void {
    player.positionLocked = false;
    player.positionX = 0;
    player.positionZ = 0;
    player.ready = false;
  }

  private clearPreBattleState(player: PlayerState): void {
    player.hasAnsweredCurrent = false;
    player.localization = "not_started";
    this.clearPositioningState(player);
    player.maxHp = BATTLE.START_HP;
    player.hp = BATTLE.START_HP;
    player.shield = 0;
    player.charges = WEAPONS.bolt.charges;
    player.nextAttackAt = 0;
    player.eliminated = false;
    player.disconnectedAt = 0;
  }

  private excludeFromCombat(player: PlayerState): void {
    player.combatIncluded = false;
    this.clearPositioningState(player);
  }

  private markConnected(member: WarRoomMember): void {
    if (member.kind === "organizer") {
      this.state.organizer.connected = true;
      return;
    }
    const player = this.state.players.get(member.playerId);
    if (player === undefined) return;
    player.connected = true;
    player.disconnectedAt = 0;
  }

  private uniqueDisplayName(baseName: string): string {
    const names = new Set([...this.state.players.values()].map((player) => player.displayName));
    if (!names.has(baseName)) return baseName;
    let suffix = 2;
    while (names.has(`${baseName} (${suffix})`)) suffix += 1;
    return `${baseName} (${suffix})`;
  }
}
