import { BATTLE, type CommandName, type PlayerId } from "@codexwars/shared";
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

  removeConnectedParticipant(sessionId: string): ParticipantMember | undefined {
    const member = this.membersBySessionId.get(sessionId);
    if (member?.kind !== "participant") return undefined;
    const player = this.state.players.get(member.playerId);
    if (player === undefined || !player.connected) return undefined;
    this.state.players.delete(member.playerId);
    this.participantsById.delete(member.playerId);
    this.membersBySessionId.delete(sessionId);
    return member;
  }

  clearCommandOutcomes(): void {
    this.organizer?.commandOutcomes.clear();
    for (const participant of this.participantsById.values()) participant.commandOutcomes.clear();
  }

  organizerReconnectPolicy(): { readonly closeRoomOnExpiry: boolean; readonly graceMs: number } {
    const activeBattle = this.state.phase === "countdown" || this.state.phase === "battle";
    return activeBattle
      ? { closeRoomOnExpiry: false, graceMs: BATTLE.DISCONNECT_ELIMINATION_MS }
      : { closeRoomOnExpiry: true, graceMs: BATTLE.HOST_RECONNECT_GRACE_MS };
  }

  participantReconnectExpired(playerId: PlayerId): boolean {
    const player = this.state.players.get(playerId);
    const activeBattle = this.state.phase === "countdown" || this.state.phase === "battle";
    if (player === undefined || player.connected || !activeBattle || player.eliminated) return false;
    player.hp = 0;
    player.eliminated = true;
    return true;
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
