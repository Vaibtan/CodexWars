import { describe, expect, it } from "vitest";
import { RoomIdAllocationError, RoomIdAllocator, type PresenceSet } from "../src/rooms/room-id.js";

class MemoryPresence implements PresenceSet {
  readonly values = new Set<string>();

  async sadd(_channel: string, value: string): Promise<number> {
    if (this.values.has(value)) return 0;
    this.values.add(value);
    return 1;
  }

  async sismember(_channel: string, value: string): Promise<number> {
    return this.values.has(value) ? 1 : 0;
  }

  async srem(_channel: string, value: string): Promise<void> {
    this.values.delete(value);
  }
}

class LocalPresence implements PresenceSet {
  readonly values = new Set<string>();

  sadd(_channel: string, value: string): void {
    this.values.add(value);
  }

  async sismember(_channel: string, value: string): Promise<number> {
    return this.values.has(value) ? 1 : 0;
  }

  srem(_channel: string, value: string): void {
    this.values.delete(value);
  }
}

describe("four-digit room ID allocation", () => {
  it("retries collisions, reserves one active code, and releases it on disposal", async () => {
    const presence = new MemoryPresence();
    presence.values.add("0000");
    const candidates = ["0000", "0042"];
    const allocator = new RoomIdAllocator(presence, () => candidates.shift() ?? "9999");

    const roomId = await allocator.allocate();

    expect(roomId).toBe("0042");
    expect(presence.values).toEqual(new Set(["0000", "0042"]));
    await allocator.release(roomId);
    expect(presence.values).toEqual(new Set(["0000"]));
  });

  it("fails after exactly one hundred unavailable candidates", async () => {
    const presence = new MemoryPresence();
    const allocator = new RoomIdAllocator(presence, () => "0000", 100);
    await allocator.allocate();

    await expect(new RoomIdAllocator(presence, () => "0000", 100).allocate()).rejects.toEqual(new RoomIdAllocationError());
  });

  it("atomically reserves unique codes when rooms are created concurrently", async () => {
    const presence = new MemoryPresence();
    const allocations = await Promise.all(
      Array.from({ length: 12 }, async () => {
        let index = 0;
        const allocator = new RoomIdAllocator(presence, () => (index++).toString().padStart(4, "0"));
        return { allocator, roomId: await allocator.allocate() };
      })
    );

    expect(new Set(allocations.map(({ roomId }) => roomId))).toHaveLength(12);
    expect(presence.values).toHaveLength(12);
    await Promise.all(allocations.map(({ allocator, roomId }) => allocator.release(roomId)));
    expect(presence.values).toHaveLength(0);
  });

  it("serializes local-presence allocation because local sadd does not report whether it inserted", async () => {
    const presence = new LocalPresence();
    const roomIds = await Promise.all(
      Array.from({ length: 12 }, async () => {
        let index = 0;
        return new RoomIdAllocator(presence, () => (index++).toString().padStart(4, "0")).allocate();
      })
    );

    expect(new Set(roomIds)).toHaveLength(12);
    expect(presence.values).toHaveLength(12);
  });
});
