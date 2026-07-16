import type { RealtimeTransport, Unsubscribe } from "../realtimeClient";

type MessageListener = (payload: unknown) => void;

export class FakeRealtimeTransport implements RealtimeTransport {
  readonly roomId = "0427";
  readonly sent: Array<{ readonly payload: unknown; readonly type: string }> = [];
  leaveCalls = 0;
  private readonly dropListeners = new Set<() => void>();
  private readonly errorListeners = new Set<(code: number, message: string) => void>();
  private readonly leaveListeners = new Set<(code: number) => void>();
  private readonly messageListeners = new Map<string, Set<MessageListener>>();
  private readonly reconnectListeners = new Set<() => void>();
  private readonly stateListeners = new Set<(state: unknown) => void>();

  async leave(): Promise<void> {
    this.leaveCalls += 1;
  }

  onDrop(listener: () => void): Unsubscribe {
    this.dropListeners.add(listener);
    return () => this.dropListeners.delete(listener);
  }

  onError(listener: (code: number, message: string) => void): Unsubscribe {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onLeave(listener: (code: number) => void): Unsubscribe {
    this.leaveListeners.add(listener);
    return () => this.leaveListeners.delete(listener);
  }

  onMessage(type: string, listener: MessageListener): Unsubscribe {
    const listeners = this.messageListeners.get(type) ?? new Set<MessageListener>();
    listeners.add(listener);
    this.messageListeners.set(type, listeners);
    return () => listeners.delete(listener);
  }

  onReconnect(listener: () => void): Unsubscribe {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  onStateChange(listener: (state: unknown) => void): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  send(type: string, payload: unknown): void {
    this.sent.push({ payload, type });
  }

  emitMessage(type: string, payload: unknown): void {
    for (const listener of this.messageListeners.get(type) ?? []) listener(payload);
  }

  emitError(code: number, message: string): void {
    for (const listener of this.errorListeners) listener(code, message);
  }

  emitLeave(code: number): void {
    for (const listener of this.leaveListeners) listener(code);
  }

  emitState(state: unknown): void {
    for (const listener of this.stateListeners) listener(state);
  }
}
