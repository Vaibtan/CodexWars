import {
  PROTOCOL_VERSION,
  commandEnvelope,
  isClientEventPayload,
  isPublicRoomStateProjection,
  type ClientEventPayloads,
  type CommandName,
  type CommandPayloads,
  type PublicRoomState,
} from "@codexwars/shared";
import { WarRoomCommandError } from "./errors";
import type { WarRoomRole, WarRoomSession } from "./types";

export { WarRoomCommandError, type WarRoomErrorCode } from "./errors";

export type Unsubscribe = () => void;

export type WarRoomCommandReceipt = ClientEventPayloads["command_accepted"];

export interface WarRoomSnapshot {
  readonly connected: boolean;
  readonly error: Error | null;
  readonly loading: boolean;
  readonly room: PublicRoomState | null;
  readonly quizPreview: ClientEventPayloads["quiz_prepared"] | null;
  readonly session: WarRoomSession;
}

export interface WarRoomRealtimeClient {
  readonly session: WarRoomSession;
  dispose(): Promise<void>;
  getSnapshot(): WarRoomSnapshot;
  send<Name extends CommandName>(name: Name, payload: CommandPayloads[Name]): Promise<WarRoomCommandReceipt>;
  subscribe(listener: (snapshot: WarRoomSnapshot) => void): Unsubscribe;
}

export interface RealtimeTransport {
  readonly roomId: string;
  leave(): Promise<void>;
  onDrop(listener: () => void): Unsubscribe;
  onError(listener: (code: number, message: string) => void): Unsubscribe;
  onLeave(listener: (code: number) => void): Unsubscribe;
  onMessage(type: string, listener: (payload: unknown) => void): Unsubscribe;
  onReconnect(listener: () => void): Unsubscribe;
  onStateChange(listener: (state: unknown) => void): Unsubscribe;
  send(type: string, payload: unknown): void;
}

interface AttachOptions {
  readonly identityTimeoutMs?: number;
  readonly nickname: string;
  readonly role: WarRoomRole;
  readonly transport: RealtimeTransport;
}

interface PendingCommand {
  readonly reject: (error: Error) => void;
  readonly resolve: (receipt: WarRoomCommandReceipt) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

const COMMAND_TIMEOUT_MS = 8_000;
let commandSequence = 0;

class ColyseusWarRoomClient implements WarRoomRealtimeClient {
  private disposed = false;
  private readonly listeners = new Set<(snapshot: WarRoomSnapshot) => void>();
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private snapshot: WarRoomSnapshot;
  private readonly unsubscribers: Unsubscribe[];

  constructor(
    private readonly transport: RealtimeTransport,
    readonly session: WarRoomSession,
  ) {
    this.snapshot = { connected: true, error: null, loading: true, quizPreview: null, room: null, session };
    this.unsubscribers = [
      transport.onStateChange((state) => this.receiveState(state)),
      transport.onMessage("command_accepted", (payload) => this.receiveCommandAccepted(payload)),
      transport.onMessage("server_error", (payload) => this.receiveServerError(payload)),
      transport.onMessage("quiz_prepared", (payload) => this.receiveQuizPrepared(payload)),
      transport.onDrop(() => this.updateConnection(false)),
      transport.onReconnect(() => this.updateConnection(true)),
      transport.onError(() => this.setError(new WarRoomCommandError("The War Room connection was interrupted. Reconnecting may resolve it.", "CONNECTION_FAILED", true))),
      transport.onLeave(() => {
        if (!this.disposed) this.setError(new WarRoomCommandError("This War Room session has ended. Join again with the room code.", "SESSION_EXPIRED", false));
        this.updateConnection(false);
      }),
    ];
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    for (const [commandId, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`War Room closed before command ${commandId} completed.`));
    }
    this.pendingCommands.clear();
    this.listeners.clear();
    await this.transport.leave();
  }

  getSnapshot(): WarRoomSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: WarRoomSnapshot) => void): Unsubscribe {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  send<Name extends CommandName>(name: Name, command: CommandPayloads[Name]): Promise<WarRoomCommandReceipt> {
    if (this.disposed) return Promise.reject(new Error("War Room session is closed."));
    const room = this.snapshot.room;
    if (room === null) return Promise.reject(new Error("War Room state has not loaded yet."));
    if (!this.snapshot.connected) return Promise.reject(new Error("War Room is reconnecting. Try again in a moment."));

    const commandId = createCommandId();
    const { payload } = commandEnvelope(name, command, { commandId, roundId: room.roundId });
    const outcome = new Promise<WarRoomCommandReceipt>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`War Room command ${name} timed out.`));
      }, COMMAND_TIMEOUT_MS);
      this.pendingCommands.set(commandId, { reject, resolve, timeout });
    });
    this.transport.send(name, payload);
    return outcome;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private receiveCommandAccepted(payload: unknown): void {
    if (!isClientEventPayload("command_accepted", payload)) {
      this.setError(new Error("Invalid command acknowledgement received from the War Room server."));
      return;
    }
    const pending = this.pendingCommands.get(payload.commandId);
    if (pending === undefined) return;
    clearTimeout(pending.timeout);
    this.pendingCommands.delete(payload.commandId);
    pending.resolve(payload);
  }

  private receiveServerError(payload: unknown): void {
    if (!isClientEventPayload("server_error", payload)) {
      this.setError(new Error("Invalid error payload received from the War Room server."));
      return;
    }
    const error = new WarRoomCommandError(payload.message, payload.code, payload.retryable);
    const pending = payload.commandId === undefined ? undefined : this.pendingCommands.get(payload.commandId);
    if (pending !== undefined && payload.commandId !== undefined) {
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(payload.commandId);
      pending.reject(error);
    }
    this.setError(error);
  }

  private receiveState(state: unknown): void {
    if (!isPublicRoomStateProjection(state)) {
      this.setError(new Error("Invalid synchronized War Room state received from the server."));
      return;
    }
    if (state.roomId !== this.session.roomId) {
      this.setError(new Error("War Room state did not match the joined room."));
      return;
    }
    const clearPreview = this.snapshot.room?.roundId !== state.roundId || state.quiz.status === "unconfigured" || state.quiz.status === "configured";
    this.snapshot = { ...this.snapshot, error: null, loading: false, ...(clearPreview ? { quizPreview: null } : {}), room: state };
    this.emit();
  }

  private receiveQuizPrepared(payload: unknown): void {
    if (this.session.role !== "organizer" || !isClientEventPayload("quiz_prepared", payload)) {
      this.setError(new Error("Invalid private quiz preview received from the War Room server."));
      return;
    }
    if (this.snapshot.room !== null && payload.roundId !== this.snapshot.room.roundId) return;
    this.snapshot = { ...this.snapshot, quizPreview: payload };
    this.emit();
  }

  private setError(error: Error): void {
    this.snapshot = { ...this.snapshot, error, loading: false };
    this.emit();
  }

  private updateConnection(connected: boolean): void {
    this.snapshot = { ...this.snapshot, connected };
    this.emit();
  }
}

export async function attachWarRoomRealtimeClient({
  identityTimeoutMs = 5_000,
  nickname,
  role,
  transport,
}: AttachOptions): Promise<WarRoomRealtimeClient> {
  try {
    const identity = await requestSessionIdentity(transport, role, identityTimeoutMs);
    return new ColyseusWarRoomClient(transport, {
      nickname,
      playerId: identity.playerId,
      role: identity.role,
      roomId: transport.roomId,
    });
  } catch (error) {
    await transport.leave();
    throw error;
  }
}

async function requestSessionIdentity(
  transport: RealtimeTransport,
  expectedRole: WarRoomRole,
  timeoutMs: number,
): Promise<ClientEventPayloads["session_ready"]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeError: Unsubscribe = () => undefined;
    let unsubscribeIdentity: Unsubscribe = () => undefined;
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      unsubscribeIdentity();
      unsubscribeError();
      action();
    };
    unsubscribeIdentity = transport.onMessage("session_ready", (payload) => {
      if (!isClientEventPayload("session_ready", payload)) {
        finish(() => reject(new Error("Invalid session identity received from the War Room server.")));
        return;
      }
      if (payload.role !== expectedRole) {
        finish(() => reject(new Error("War Room role did not match the requested session.")));
        return;
      }
      finish(() => resolve(payload));
    });
    unsubscribeError = transport.onMessage("server_error", (payload) => {
      if (!isClientEventPayload("server_error", payload)) return;
      finish(() => reject(new WarRoomCommandError(payload.message, payload.code, payload.retryable)));
    });
    timeout = setTimeout(() => {
      finish(() => reject(new Error("Timed out while binding the War Room session.")));
    }, timeoutMs);
    transport.send("request_session", { protocolVersion: PROTOCOL_VERSION });
  });
}

function createCommandId(): string {
  commandSequence += 1;
  return `${Date.now().toString(36)}-${commandSequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
