import type { ErrorCode } from "@codexwars/shared";

export type WarRoomErrorCode = ErrorCode | "CONNECTION_FAILED";

export class WarRoomCommandError extends Error {
  constructor(
    message: string,
    readonly code: WarRoomErrorCode,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "WarRoomCommandError";
  }
}
