import type { ClientEventPayloads, PublicRoomState } from "@codexwars/shared";

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
  quizPreview: ClientEventPayloads["quiz_prepared"] | null;
  room: PublicRoomState | null;
}
