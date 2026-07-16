import type { Room } from "@colyseus/sdk";
import type { RealtimeTransport, Unsubscribe } from "./realtimeClient";

function plainState(state: unknown): unknown {
  if (typeof state !== "object" || state === null || !("toJSON" in state)) return state;
  const toJSON = (state as { readonly toJSON?: unknown }).toJSON;
  return typeof toJSON === "function" ? toJSON.call(state) : state;
}

export class ColyseusRoomTransport implements RealtimeTransport {
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
