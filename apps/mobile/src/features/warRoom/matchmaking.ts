import { Client } from "@colyseus/sdk";
import { PROTOCOL_VERSION } from "@codexwars/shared";
import { getRealtimeServerUrl } from "../../config/app";
import { ColyseusRoomTransport } from "./colyseusRoomTransport";
import { WarRoomCommandError, type WarRoomErrorCode } from "./errors";
import {
  attachWarRoomRealtimeClient,
  type RealtimeTransport,
  type WarRoomRealtimeClient
} from "./realtimeClient";
import type { WarRoomRole } from "./types";

interface MatchmakingOptions {
  readonly displayName: string;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
}

export interface MatchmakingAdapter {
  create(options: MatchmakingOptions): Promise<RealtimeTransport>;
  joinById(roomId: string, options: MatchmakingOptions): Promise<RealtimeTransport>;
}

const MATCHMAKING_ERROR_CODES = [
  "CLIENT_VERSION_UNSUPPORTED",
  "CONNECTION_FAILED",
  "NICKNAME_INVALID",
  "ROOM_FULL",
  "ROOM_ID_EXHAUSTED",
  "ROOM_NOT_FOUND",
  "ROOM_NOT_JOINABLE",
  "SESSION_EXPIRED"
] as const satisfies readonly WarRoomErrorCode[];

type MatchmakingErrorCode = typeof MATCHMAKING_ERROR_CODES[number];

const ERROR_MESSAGES: Record<MatchmakingErrorCode, string> = {
  CLIENT_VERSION_UNSUPPORTED: "Update CodexWars before joining this War Room.",
  CONNECTION_FAILED: "The War Room server is unavailable. Try again shortly.",
  NICKNAME_INVALID: "Enter a nickname between 1 and 20 valid characters.",
  ROOM_FULL: "This War Room is full.",
  ROOM_ID_EXHAUSTED: "A War Room code could not be allocated. Try again.",
  ROOM_NOT_FOUND: "That War Room could not be found.",
  ROOM_NOT_JOINABLE: "That War Room is no longer accepting participants.",
  SESSION_EXPIRED: "This War Room session has expired. Join again with the room code."
};

const RETRYABLE_CODES: readonly MatchmakingErrorCode[] = ["CONNECTION_FAILED", "ROOM_ID_EXHAUSTED"];

export class WarRoomMatchmaker {
  constructor(private readonly adapter: MatchmakingAdapter) {}

  createOrganizer(organizerName: string): Promise<WarRoomRealtimeClient> {
    return this.openAndAttach("organizer", organizerName, () => this.adapter.create(this.options(organizerName)));
  }

  joinParticipant(roomCode: string, nickname: string): Promise<WarRoomRealtimeClient> {
    const normalizedRoomCode = roomCode.trim();
    if (!/^\d{4}$/u.test(normalizedRoomCode)) return Promise.reject(matchmakingError("ROOM_NOT_FOUND"));
    return this.openAndAttach("participant", nickname, () => this.adapter.joinById(normalizedRoomCode, this.options(nickname)));
  }

  private async openAndAttach(role: WarRoomRole, nickname: string, open: () => Promise<RealtimeTransport>): Promise<WarRoomRealtimeClient> {
    try {
      const transport = await open();
      return await attachWarRoomRealtimeClient({ nickname, role, transport });
    } catch (error) {
      throw normalizeMatchmakingError(error);
    }
  }

  private options(displayName: string): MatchmakingOptions {
    return { displayName, protocolVersion: PROTOCOL_VERSION };
  }
}

class ColyseusMatchmakingAdapter implements MatchmakingAdapter {
  constructor(private readonly client: Client) {}

  async create(options: MatchmakingOptions): Promise<RealtimeTransport> {
    return new ColyseusRoomTransport(await this.client.create("war", options));
  }

  async joinById(roomId: string, options: MatchmakingOptions): Promise<RealtimeTransport> {
    return new ColyseusRoomTransport(await this.client.joinById(roomId, options));
  }
}

function matchmakingError(code: MatchmakingErrorCode): WarRoomCommandError {
  return new WarRoomCommandError(ERROR_MESSAGES[code], code, RETRYABLE_CODES.includes(code));
}

function normalizeMatchmakingError(error: unknown): WarRoomCommandError {
  if (error instanceof WarRoomCommandError) return error;
  const message = error instanceof Error ? error.message : "";
  const exactCode = MATCHMAKING_ERROR_CODES.find((code) => message.includes(code));
  if (exactCode !== undefined) return matchmakingError(exactCode);
  if (/already full|\bis locked\b/iu.test(message)) return matchmakingError("ROOM_FULL");
  if (/not found/iu.test(message)) return matchmakingError("ROOM_NOT_FOUND");
  if (/expired|reconnection token/iu.test(message)) return matchmakingError("SESSION_EXPIRED");
  return matchmakingError("CONNECTION_FAILED");
}

function productionMatchmaker(): WarRoomMatchmaker {
  return new WarRoomMatchmaker(new ColyseusMatchmakingAdapter(new Client(getRealtimeServerUrl())));
}

export function createOrganizerWarRoom(organizerName: string): Promise<WarRoomRealtimeClient> {
  return productionMatchmaker().createOrganizer(organizerName);
}

export function joinParticipantWarRoom(roomCode: string, nickname: string): Promise<WarRoomRealtimeClient> {
  return productionMatchmaker().joinParticipant(roomCode, nickname);
}
