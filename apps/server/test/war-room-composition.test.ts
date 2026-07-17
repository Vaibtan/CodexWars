import { describe, expect, it } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { createAppConfig } from "../src/app.config.js";
import { WarRoomHarness } from "./support/war-room-harness.js";

describe("War Room composition", () => {
  it("keeps dependencies isolated between concurrently registered room classes", async () => {
    const firstLogs: unknown[] = [];
    const secondLogs: unknown[] = [];
    let first: ColyseusTestServer | undefined;
    let second: ColyseusTestServer | undefined;

    try {
      const firstConfig = createAppConfig({ log: (entry) => firstLogs.push(entry), now: () => 11_000 });
      await firstConfig.listen(2671);
      first = new ColyseusTestServer(firstConfig);
      const firstRoom = await WarRoomHarness.create(first);

      const secondConfig = createAppConfig({ log: (entry) => secondLogs.push(entry), now: () => 22_000 });
      await secondConfig.listen(2672);
      second = new ColyseusTestServer(secondConfig);
      const secondRoom = await WarRoomHarness.create(second);
      await firstRoom.waitForPatch();

      expect(firstRoom.room.state.serverNow).toBe(11_000);
      expect(secondRoom.room.state.serverNow).toBe(22_000);
      expect(firstLogs).toEqual([]);
      expect(secondLogs).toEqual([]);
    } finally {
      await first?.shutdown();
      await second?.shutdown();
    }
  });
});
