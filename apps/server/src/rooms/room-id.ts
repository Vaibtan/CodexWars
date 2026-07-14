import { randomInt } from "node:crypto";

const ROOM_ID_CHANNEL = "codexwars:p0:room-ids";
const FOUR_DIGIT_CODE = /^\d{4}$/u;

class AsyncMutex {
  private tail = Promise.resolve();

  async run<T>(operation: () => Promise<T>): Promise<T> {
    let release: () => void = () => undefined;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.tail;
    this.tail = previous.then(() => next);
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

const allocationMutexes = new WeakMap<PresenceSet, Map<string, AsyncMutex>>();

function allocationMutex(presence: PresenceSet, channel: string): AsyncMutex {
  let byChannel = allocationMutexes.get(presence);
  if (byChannel === undefined) {
    byChannel = new Map();
    allocationMutexes.set(presence, byChannel);
  }
  let mutex = byChannel.get(channel);
  if (mutex === undefined) {
    mutex = new AsyncMutex();
    byChannel.set(channel, mutex);
  }
  return mutex;
}

export interface PresenceSet {
  sadd(channel: string, value: string): number | void | Promise<number | void>;
  sismember(channel: string, value: string): number | Promise<number>;
  srem(channel: string, value: string): void | Promise<void>;
}

export class RoomIdAllocationError extends Error {
  readonly code = "ROOM_ID_EXHAUSTED";

  constructor() {
    super("ROOM_ID_EXHAUSTED");
    this.name = "RoomIdAllocationError";
  }
}

export function generateFourDigitRoomId(): string {
  return randomInt(0, 10_000).toString().padStart(4, "0");
}

export class RoomIdAllocator {
  constructor(
    private readonly presence: PresenceSet,
    private readonly generateCandidate: () => string = generateFourDigitRoomId,
    private readonly maxAttempts = 100,
    private readonly channel = ROOM_ID_CHANNEL
  ) {}

  async allocate(): Promise<string> {
    return allocationMutex(this.presence, this.channel).run(() => this.allocateReserved());
  }

  private async allocateReserved(): Promise<string> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const candidate = this.generateCandidate();
      if (!FOUR_DIGIT_CODE.test(candidate)) throw new TypeError("room ID generator must return four decimal digits");
      if (await this.presence.sismember(this.channel, candidate) === 1) continue;
      const result = await this.presence.sadd(this.channel, candidate);
      // LocalPresence reports no insertion result, so the per-process mutex makes
      // the preceding membership check authoritative. Redis-backed presence
      // returns 1 only when this allocator won the cross-process reservation.
      if (result === undefined || result === 1) return candidate;
    }
    throw new RoomIdAllocationError();
  }

  async release(roomId: string): Promise<void> {
    await this.presence.srem(this.channel, roomId);
  }
}
