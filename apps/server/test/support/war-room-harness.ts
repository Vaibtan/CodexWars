import type { Room as ClientRoom } from "@colyseus/sdk";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { WarRoom } from "../../src/rooms/war-room.js";

export class WarRoomHarness {
  private commandSequence = 0;

  private constructor(
    private readonly server: ColyseusTestServer,
    readonly room: WarRoom,
    readonly organizer: ClientRoom
  ) {}

  get commandCount(): number {
    return this.commandSequence;
  }

  static async create(server: ColyseusTestServer, organizerName = "Teacher"): Promise<WarRoomHarness> {
    const options = { displayName: organizerName, protocolVersion: 1 };
    const room = await server.createRoom<WarRoom>("war", options);
    const organizer = await server.connectTo(room, options);
    return new WarRoomHarness(server, room, organizer);
  }

  command(prefix = "cmd"): { readonly commandId: string; readonly roundId: number } {
    return { commandId: `${prefix}-${this.commandSequence++}`, roundId: this.room.state.roundId };
  }

  async disconnectUnexpectedly(client: ClientRoom): Promise<string> {
    const reconnectionToken = client.reconnectionToken;
    client.reconnection.enabled = false;
    client.connection.close();
    await this.waitForPatch();
    return reconnectionToken;
  }

  async joinParticipant(displayName: string): Promise<ClientRoom> {
    return this.server.connectTo(this.room, { displayName, protocolVersion: 1 });
  }

  async reconnect(reconnectionToken: string): Promise<ClientRoom> {
    const client = await this.server.sdk.reconnect(reconnectionToken);
    await this.waitForPatch();
    return client;
  }

  async sendAndPatch(client: ClientRoom, type: string, payload: object): Promise<void> {
    client.send(type, payload);
    await this.waitForPatch();
  }

  waitForPatch(): Promise<void> {
    return this.room.waitForNextPatch();
  }
}
