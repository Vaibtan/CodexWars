import { describe, expect, it } from "vitest";
import { BATTLE } from "@codexwars/shared";
import { BattleRound, type BattleRoundEvent } from "../src/rooms/battle-round.js";
import { PlayerState, WarRoomState } from "../src/rooms/state.js";

function combatPlayer(playerId: string, x: number): PlayerState {
  const player = new PlayerState();
  player.playerId = playerId;
  player.displayName = playerId;
  player.localization = "localized";
  player.positionLocked = true;
  player.positionX = x;
  player.quizCompleted = true;
  player.ready = true;
  return player;
}

function battleState(): WarRoomState {
  const state = new WarRoomState();
  state.phase = "positioning";
  state.players.set("player-1", combatPlayer("player-1", -1));
  state.players.set("player-2", combatPlayer("player-2", 1));
  return state;
}

describe("Battle Round", () => {
  it("owns start validation and countdown activation", () => {
    const state = battleState();
    const events: BattleRoundEvent[] = [];
    const battle = new BattleRound(state, (event) => events.push(event));

    expect(battle.start(1_000)).toEqual({ ok: true });
    expect(state).toMatchObject({ phase: "countdown", battle: { status: "countdown", startsAt: 1_000 + BATTLE.COUNTDOWN_MS } });
    expect(events).toEqual([expect.objectContaining({ type: "battle_countdown_started" })]);

    battle.advance(state.battle.startsAt);
    expect(state).toMatchObject({ phase: "battle", battle: { status: "active" } });
  });

  it("returns every battle-start blocker without partially starting", () => {
    const state = battleState();
    const player = state.players.get("player-2")!;
    player.connected = false;
    player.ready = false;
    const battle = new BattleRound(state, () => undefined);

    expect(battle.start(1_000)).toEqual({
      blockers: [
        { playerId: "player-2", reason: "DISCONNECTED" },
        { playerId: "player-2", reason: "NOT_READY" }
      ],
      ok: false
    });
    expect(state.phase).toBe("positioning");
  });

  it("applies shield overflow, elimination, standings, and completion exactly once", () => {
    const state = battleState();
    const events: BattleRoundEvent[] = [];
    const battle = new BattleRound(state, (event) => events.push(event));
    battle.start(1_000);
    battle.advance(state.battle.startsAt);
    const target = state.players.get("player-2")!;
    target.hp = 5;
    target.shield = 5;

    expect(battle.attack({ commandId: "attack-1", dirX: 1, dirZ: 0, now: state.battle.startsAt, playerId: "player-1" })).toEqual({ ok: true });
    expect(target).toMatchObject({ eliminated: true, hp: 0, shield: 0 });
    expect(state).toMatchObject({ phase: "results", battle: { completionReason: "last_alive", status: "completed", winnerId: "player-1" } });
    expect(events.map((event) => event.type)).toEqual(["battle_countdown_started", "attack_resolved", "player_eliminated", "battle_completed"]);

    battle.completeIfLastAlive();
    expect(events.filter((event) => event.type === "battle_completed")).toHaveLength(1);
  });
});
