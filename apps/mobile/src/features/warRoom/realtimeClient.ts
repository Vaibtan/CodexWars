import type { ArenaPosition, CharacterSelection, WarRoomState, WeaponId } from "@codexwars/shared";
import type { Unsubscribe } from "firebase/database";
import {
  attackParticipant,
  completeQuiz,
  createWarRoom,
  endBattle,
  joinWarRoom,
  lockPosition,
  openQuizQuestion,
  scoreQuizQuestion,
  selectCharacter,
  setLobbyReady,
  setArenaReady,
  startBattle,
  startBattleSetup,
  startOrganizerAuthority,
  startQuiz,
  submitQuizAnswer,
  subscribeToWarRoom,
  waitForCommandResolution,
  type WarRoomCommandReceipt,
} from "../../lib/firebase/warRooms";
import type { WarRoomSession } from "./types";

export type WarRoomIntent =
  | { ready: boolean; type: "set_lobby_ready" }
  | { type: "start_quiz" }
  | { endsAt: number; questionId: string; questionIndex: number; type: "open_quiz_question" }
  | { optionId: string; type: "submit_quiz_answer" }
  | { correctOptionId: string; revealEndsAt: number; type: "score_quiz_question" }
  | { type: "complete_quiz" }
  | { type: "start_battle_setup" }
  | { selection: CharacterSelection; type: "select_character" }
  | { radiusM: number; type: "set_arena_ready" }
  | { position: ArenaPosition; type: "lock_position" }
  | { durationMs?: number; type: "start_battle" }
  | { dirX: number; dirZ: number; predictedTargetId?: string; type: "attack"; weaponId: WeaponId }
  | { type: "end_battle" };

export interface WarRoomSnapshot {
  error: Error | null;
  room: WarRoomState | null;
  session: WarRoomSession;
}

export interface WarRoomRealtimeClient {
  dispose(): void;
  getSnapshot(): WarRoomSnapshot;
  send(intent: WarRoomIntent): Promise<WarRoomCommandReceipt | void>;
  subscribe(listener: (snapshot: WarRoomSnapshot) => void): Unsubscribe;
}

class FirebaseWarRoomClient implements WarRoomRealtimeClient {
  private readonly listeners = new Set<(snapshot: WarRoomSnapshot) => void>();
  private readonly unsubscribeAuthority: Unsubscribe;
  private readonly unsubscribeRoom: Unsubscribe;
  private snapshot: WarRoomSnapshot;

  constructor(readonly session: WarRoomSession) {
    this.snapshot = { error: null, room: null, session };
    this.unsubscribeRoom = subscribeToWarRoom(session.roomId, (room) => {
      this.snapshot = { ...this.snapshot, room };
      this.emit();
    }, (error) => {
      this.snapshot = { ...this.snapshot, error };
      this.emit();
    });
    this.unsubscribeAuthority = startOrganizerAuthority(session, (error) => {
      this.snapshot = { ...this.snapshot, error };
      this.emit();
    });
  }

  dispose(): void {
    this.unsubscribeAuthority();
    this.unsubscribeRoom();
    this.listeners.clear();
  }

  getSnapshot(): WarRoomSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: WarRoomSnapshot) => void): Unsubscribe {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async send(intent: WarRoomIntent): Promise<WarRoomCommandReceipt | void> {
    const room = this.snapshot.room;
    if (!room) throw new Error("War Room state has not loaded yet.");
    switch (intent.type) {
      case "set_lobby_ready": return this.resolve(setLobbyReady(this.session, room, intent.ready));
      case "start_quiz": return this.resolve(startQuiz(this.session, room));
      case "open_quiz_question": return this.resolve(openQuizQuestion(this.session, room, intent.questionId, intent.questionIndex, intent.endsAt));
      case "submit_quiz_answer": return submitQuizAnswer(this.session, room, intent.optionId);
      case "score_quiz_question": return this.resolve(scoreQuizQuestion(this.session, room, intent.correctOptionId, intent.revealEndsAt));
      case "complete_quiz": return this.resolve(completeQuiz(this.session, room));
      case "start_battle_setup": return this.resolve(startBattleSetup(this.session, room));
      case "select_character": return this.resolve(selectCharacter(this.session, room, intent.selection));
      case "set_arena_ready": return this.resolve(setArenaReady(this.session, room, intent.radiusM));
      case "lock_position": return this.resolve(lockPosition(this.session, room, intent.position));
      case "start_battle": return this.resolve(startBattle(this.session, room, intent.durationMs));
      case "attack": return this.resolve(attackParticipant(this.session, room, intent, intent.weaponId));
      case "end_battle": return this.resolve(endBattle(this.session, room));
    }
  }

  private async resolve(command: Promise<string>): Promise<WarRoomCommandReceipt> {
    return waitForCommandResolution(this.session.roomId, await command);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.snapshot);
  }
}

export async function createOrganizerWarRoom(organizerName: string): Promise<WarRoomRealtimeClient> {
  return new FirebaseWarRoomClient(await createWarRoom(organizerName));
}

export async function joinParticipantWarRoom(roomCode: string, nickname: string): Promise<WarRoomRealtimeClient> {
  return new FirebaseWarRoomClient(await joinWarRoom(roomCode, nickname));
}
