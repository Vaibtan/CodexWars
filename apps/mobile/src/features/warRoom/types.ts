import type { WarRoomState } from "@codexwars/shared";

export type WarRoomRole = "organizer" | "participant";

export interface WarRoomSession {
  nickname: string;
  role: WarRoomRole;
  roomId: string;
  uid: string;
}

export interface WarRoomSubscriptionState {
  connected: boolean;
  error: Error | null;
  loading: boolean;
  room: WarRoomState | null;
}
