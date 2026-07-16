import type { PublicRoomState } from "@codexwars/shared";

export type WarRoomRole = "organizer" | "participant";

export interface WarRoomSession {
  nickname: string;
  playerId: string | null;
  role: WarRoomRole;
  roomId: string;
}

export interface WarRoomSubscriptionState {
  connected: boolean;
  error: Error | null;
  loading: boolean;
  room: PublicRoomState | null;
}
