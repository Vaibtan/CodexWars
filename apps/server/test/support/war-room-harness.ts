import type { Room as ClientRoom } from "@colyseus/sdk";
import type { ColyseusTestServer } from "@colyseus/testing";
import { PROGRAMMING_FUNDAMENTALS_V1, type ClientEventPayloads } from "@codexwars/shared";
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

  async commandError(client: ClientRoom, type: string, payload: object): Promise<ClientEventPayloads["server_error"]> {
    const error = client.waitForMessage("server_error");
    client.send(type, payload);
    return error;
  }

  async completeQuiz(setNow: (now: number) => void): Promise<void> {
    await this.sendAndPatch(this.organizer, "start_quiz", this.command());
    await this.finishQuiz(setNow);
  }

  async finishQuiz(setNow: (now: number) => void): Promise<void> {
    const firstQuestionIndex = this.room.state.quiz.questionIndex;
    for (const question of PROGRAMMING_FUNDAMENTALS_V1.questions.slice(firstQuestionIndex)) {
      if (this.room.state.quiz.currentQuestion.id !== question.id) throw new Error(`Expected Quiz Run question ${question.id}`);
      setNow(this.room.state.quiz.questionEndsAt);
      await this.waitForPatch();
      setNow(this.room.state.quiz.revealEndsAt);
      await this.waitForPatch();
    }
  }

  async advanceToBattle(
    participants: readonly ClientRoom[],
    positions: readonly { readonly x: number; readonly z: number }[],
    setNow: (now: number) => void
  ): Promise<void> {
    await this.completeQuiz(setNow);
    await this.advanceFromLocalizationToBattle(participants, positions, setNow);
  }

  async advanceFromLocalizationToBattle(
    participants: readonly ClientRoom[],
    positions: readonly { readonly x: number; readonly z: number }[],
    setNow: (now: number) => void
  ): Promise<void> {
    if (participants.length !== positions.length) throw new Error("Each battle participant requires one Locked Position");
    for (const participant of participants) participant.send("localization_changed", { ...this.command(), state: "localized" });
    await this.waitForPatch();
    for (const [index, participant] of participants.entries()) participant.send("lock_position", { ...this.command(), ...positions[index] });
    await this.waitForPatch();
    for (const participant of participants) participant.send("ready_changed", { ...this.command(), ready: true });
    await this.waitForPatch();
    await this.sendAndPatch(this.organizer, "start_battle", this.command());
    setNow(this.room.state.battle.startsAt);
    await this.waitForPatch();
  }

  async sendAndPatch(client: ClientRoom, type: string, payload: object): Promise<void> {
    client.send(type, payload);
    await this.waitForPatch();
  }

  waitForPatch(): Promise<void> {
    return this.room.waitForNextPatch();
  }
}
