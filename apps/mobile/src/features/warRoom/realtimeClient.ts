import { Client, type Room } from "@colyseus/sdk";
import {
  PROTOCOL_VERSION,
  isClientEventPayload,
  isPublicRoomStateProjection,
  type CharacterSelection,
  type ClientEventPayloads,
  type CommandName,
  type LocalizationState,
  type PlayerId,
  type PublicRoomState,
} from "@codexwars/shared";
import { getRealtimeServerUrl } from "../../config/app";
import type { WarRoomRole, WarRoomSession } from "./types";

export type Unsubscribe = () => void;

export type WarRoomIntent =
  | { readonly included: boolean; readonly playerId: PlayerId; readonly type: "set_combat_included" }
  | { readonly radiusM: number; readonly type: "configure_arena" }
  | { readonly type: "start_quiz" }
  | { readonly selection: CharacterSelection; readonly type: "select_character" }
  | { readonly optionId: string; readonly questionId: string; readonly type: "quiz_answer" }
  | { readonly state: Extract<LocalizationState, "localized" | "lost" | "searching">; readonly type: "localization_changed" }
  | { readonly position: { readonly x: number; readonly z: number }; readonly type: "lock_position" }
  | { readonly type: "unlock_position" }
  | { readonly ready: boolean; readonly type: "ready_changed" }
  | { readonly type: "start_battle" }
  | { readonly dirX: number; readonly dirZ: number; readonly predictedTargetId?: PlayerId; readonly type: "attack" }
  | { readonly type: "reset_round" };

export type WarRoomCommandReceipt = ClientEventPayloads["command_accepted"];

export interface WarRoomSnapshot {
  readonly connected: boolean;
  readonly error: Error | null;
  readonly loading: boolean;
  readonly room: PublicRoomState | null;
  readonly session: WarRoomSession;
}

export interface WarRoomRealtimeClient {
  readonly session: WarRoomSession;
  dispose(): Promise<void>;
  getSnapshot(): WarRoomSnapshot;
  send(intent: WarRoomIntent): Promise<WarRoomCommandReceipt>;
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

export class WarRoomCommandError extends Error {
  constructor(
    message: string,
    readonly code: ClientEventPayloads["server_error"]["code"],
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "WarRoomCommandError";
  }
}

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
    this.snapshot = { connected: true, error: null, loading: true, room: null, session };
    this.unsubscribers = [
      transport.onStateChange((state) => this.receiveState(state)),
      transport.onMessage("command_accepted", (payload) => this.receiveCommandAccepted(payload)),
      transport.onMessage("server_error", (payload) => this.receiveServerError(payload)),
      transport.onDrop(() => this.updateConnection(false)),
      transport.onReconnect(() => this.updateConnection(true)),
      transport.onError((code, message) => this.setError(new Error(message || `Realtime connection error ${code}`))),
      transport.onLeave((code) => {
        if (!this.disposed) this.setError(new Error(`War Room session ended (${code}). Return home or rejoin with the room code.`));
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

  send(intent: WarRoomIntent): Promise<WarRoomCommandReceipt> {
    if (this.disposed) return Promise.reject(new Error("War Room session is closed."));
    const room = this.snapshot.room;
    if (room === null) return Promise.reject(new Error("War Room state has not loaded yet."));
    if (!this.snapshot.connected) return Promise.reject(new Error("War Room is reconnecting. Try again in a moment."));

    const commandId = createCommandId();
    const { name, payload } = commandPayload(intent, commandId, room.roundId);
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
    this.snapshot = { ...this.snapshot, error: null, loading: false, room: state };
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

export async function createOrganizerWarRoom(organizerName: string): Promise<WarRoomRealtimeClient> {
  const client = new Client(getRealtimeServerUrl());
  const room = await client.create("war", { displayName: organizerName, protocolVersion: PROTOCOL_VERSION });
  return attachWarRoomRealtimeClient({ nickname: organizerName, role: "organizer", transport: new ColyseusRoomTransport(room) });
}

export async function joinParticipantWarRoom(roomCode: string, nickname: string): Promise<WarRoomRealtimeClient> {
  const normalizedRoomCode = roomCode.trim();
  if (!/^\d{4}$/u.test(normalizedRoomCode)) throw new Error("Enter the four-digit War Room code.");
  const client = new Client(getRealtimeServerUrl());
  const room = await client.joinById(normalizedRoomCode, { displayName: nickname, protocolVersion: PROTOCOL_VERSION });
  return attachWarRoomRealtimeClient({ nickname, role: "participant", transport: new ColyseusRoomTransport(room) });
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

function commandPayload(
  intent: WarRoomIntent,
  commandId: string,
  roundId: number,
): { readonly name: CommandName; readonly payload: Record<string, unknown> } {
  const meta = { commandId, roundId };
  switch (intent.type) {
    case "set_combat_included": return { name: intent.type, payload: { ...meta, included: intent.included, playerId: intent.playerId } };
    case "configure_arena": return { name: intent.type, payload: { ...meta, radiusM: intent.radiusM } };
    case "start_quiz":
    case "unlock_position":
    case "start_battle":
    case "reset_round":
      return { name: intent.type, payload: meta };
    case "select_character": return { name: intent.type, payload: { ...meta, characterId: intent.selection.characterId, colorId: intent.selection.colorId } };
    case "quiz_answer": return { name: intent.type, payload: { ...meta, optionId: intent.optionId, questionId: intent.questionId } };
    case "localization_changed": return { name: intent.type, payload: { ...meta, state: intent.state } };
    case "lock_position": return { name: intent.type, payload: { ...meta, x: intent.position.x, z: intent.position.z } };
    case "ready_changed": return { name: intent.type, payload: { ...meta, ready: intent.ready } };
    case "attack": return { name: intent.type, payload: { ...meta, dirX: intent.dirX, dirZ: intent.dirZ, ...(intent.predictedTargetId === undefined ? {} : { predictedTargetId: intent.predictedTargetId }), weaponId: "bolt" } };
  }
}

function createCommandId(): string {
  commandSequence += 1;
  return `${Date.now().toString(36)}-${commandSequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function plainState(state: unknown): unknown {
  if (typeof state !== "object" || state === null || !("toJSON" in state)) return state;
  const toJSON = (state as { readonly toJSON?: unknown }).toJSON;
  return typeof toJSON === "function" ? toJSON.call(state) : state;
}

class ColyseusRoomTransport implements RealtimeTransport {
  constructor(private readonly room: Room) {}

  get roomId(): string {
    return this.room.roomId;
  }

  async leave(): Promise<void> {
    await this.room.leave(true);
  }

  onDrop(listener: () => void): Unsubscribe {
    this.room.onDrop(listener);
    return () => this.room.onDrop.remove(listener);
  }

  onError(listener: (code: number, message: string) => void): Unsubscribe {
    const receive = (code: number, message?: string): void => listener(code, message ?? "");
    this.room.onError(receive);
    return () => this.room.onError.remove(receive);
  }

  onLeave(listener: (code: number) => void): Unsubscribe {
    this.room.onLeave(listener);
    return () => this.room.onLeave.remove(listener);
  }

  onMessage(type: string, listener: (payload: unknown) => void): Unsubscribe {
    return this.room.onMessage(type, listener);
  }

  onReconnect(listener: () => void): Unsubscribe {
    this.room.onReconnect(listener);
    return () => this.room.onReconnect.remove(listener);
  }

  onStateChange(listener: (state: unknown) => void): Unsubscribe {
    const receive = (state: unknown): void => listener(plainState(state));
    this.room.onStateChange(receive);
    receive(this.room.state);
    return () => this.room.onStateChange.remove(receive);
  }

  send(type: string, payload: unknown): void {
    this.room.send(type, payload);
  }
}
