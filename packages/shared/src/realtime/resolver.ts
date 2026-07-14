import { consumeWeaponUse, resolveAttack } from "../battle/combat.js";
import { findNearestAimTarget, normalizeAimDirection } from "../battle/geometry.js";
import { deriveBattleLoadout } from "../battle/progression.js";
import type { BattleLoadout } from "../battle/types.js";
import type {
  WarRoomCommand,
  WarRoomCommandResolution,
  WarRoomEvent,
  WarRoomEventType,
  WarRoomRejectionCode,
  WarRoomResults,
  WarRoomState,
} from "./types.js";

const MINIMUM_PLAYER_DISTANCE_M = 1.5;
const MINIMUM_BATTLE_PARTICIPANTS = 2;

function eventKey(sequence: number, commandId: string): string {
  return `${String(sequence).padStart(8, "0")}_${commandId}`;
}

function appendEvent(
  room: WarRoomState,
  command: WarRoomCommand,
  nowMs: number,
  event: Omit<WarRoomEvent, "commandId" | "createdAt" | "id" | "revision" | "roundId" | "sequence">,
): { eventId: string; room: WarRoomState } {
  const sequence = room.eventSequence + 1;
  const revision = room.revision + 1;
  const id = eventKey(sequence, command.id);
  return {
    eventId: id,
    room: {
      ...room,
      eventSequence: sequence,
      events: {
        ...room.events,
        [id]: { ...event, commandId: command.id, createdAt: nowMs, id, revision, roundId: room.roundId, sequence },
      },
      revision,
      updatedAt: nowMs,
    },
  };
}

function completeCommand(
  room: WarRoomState,
  command: WarRoomCommand,
  nowMs: number,
  rejectionCode?: WarRoomRejectionCode,
): WarRoomState {
  return {
    ...room,
    commands: {
      ...room.commands,
      [command.id]: {
        ...command,
        ...(rejectionCode ? { rejectionCode } : {}),
        resolvedAt: nowMs,
        status: rejectionCode ? "rejected" : "resolved",
      },
    },
  };
}

function rejectCommand(
  room: WarRoomState,
  command: WarRoomCommand,
  nowMs: number,
  code: WarRoomRejectionCode,
): WarRoomCommandResolution {
  const appended = appendEvent(completeCommand(room, command, nowMs, code), command, nowMs, {
    actorId: command.actorId,
    message: `${command.type} rejected: ${code}`,
    rejectionCode: code,
    type: "command_rejected",
  });
  return { eventIds: [appended.eventId], room: appended.room, status: "rejected" };
}

function resolveSimpleEvent(
  room: WarRoomState,
  command: WarRoomCommand,
  nowMs: number,
  event: { actorId: string; message: string; type: WarRoomEventType },
): WarRoomCommandResolution {
  const appended = appendEvent(completeCommand(room, command, nowMs), command, nowMs, event);
  return { eventIds: [appended.eventId], room: appended.room, status: "applied" };
}

function memberLoadout(room: WarRoomState, memberId: string): BattleLoadout | null {
  const member = room.members[memberId];
  if (!member?.quizCompleted || member.correctAnswers === null || member.totalQuestions === null) return null;
  return room.stats[memberId] ?? deriveBattleLoadout({
    correctAnswers: member.correctAnswers,
    totalQuestions: member.totalQuestions,
  });
}

function distanceBetween(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function buildResults(room: WarRoomState, nowMs: number): WarRoomResults {
  const eliminationSequence = Object.values(room.events).reduce<Record<string, number>>((sequences, event) => {
    if (event.type === "attack_applied" && event.targetId && event.damage?.eliminated) {
      sequences[event.targetId] = event.sequence;
    }
    return sequences;
  }, {});
  const ordered = Object.entries(room.stats)
    .filter(([id]) => room.members[id]?.combatIncluded)
    .sort(([aId, a], [bId, b]) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (a.eliminated && b.eliminated && eliminationSequence[aId] !== eliminationSequence[bId]) {
        return (eliminationSequence[bId] ?? 0) - (eliminationSequence[aId] ?? 0);
      }
      if (a.hp + a.shield !== b.hp + b.shield) return b.hp + b.shield - (a.hp + a.shield);
      if (a.correctAnswers !== b.correctAnswers) return b.correctAnswers - a.correctAnswers;
      return room.members[aId].joinedAt - room.members[bId].joinedAt;
    });
  const standings = Object.fromEntries(ordered.map(([participantId, stats], index) => [participantId, {
    correctAnswers: stats.correctAnswers,
    eliminated: stats.eliminated,
    hp: stats.hp,
    nickname: room.members[participantId].nickname,
    participantId,
    rank: index + 1,
    shield: stats.shield,
  }]));
  return { completedAt: nowMs, standings, winnerId: ordered[0]?.[0] ?? null };
}

function finishBattle(room: WarRoomState, nowMs: number): WarRoomState {
  return { ...room, battleEndsAt: nowMs, phase: "results", results: buildResults(room, nowMs) };
}

export function resolveWarRoomCommand(
  room: WarRoomState,
  commandId: string,
  nowMs: number,
): WarRoomCommandResolution {
  const command = room.commands[commandId];
  if (!command) throw new Error(`Unknown War Room command: ${commandId}`);
  if (command.status !== "pending") return { eventIds: [], room, status: "duplicate" };
  if (command.roundId !== room.roundId) return rejectCommand(room, command, nowMs, "INVALID_ROUND");

  const actor = room.members[command.actorId];
  const isOrganizer = command.actorId === room.organizerId;

  if (command.type === "announce_join") {
    if (!actor) return rejectCommand(room, command, nowMs, "ACTOR_NOT_MEMBER");
    if (room.phase !== "lobby") return rejectCommand(room, command, nowMs, "INVALID_PHASE");
    return resolveSimpleEvent(room, command, nowMs, {
      actorId: actor.id,
      message: `${actor.nickname} joined the lobby`,
      type: "participant_joined",
    });
  }

  if (command.type === "start_quiz") {
    if (!isOrganizer) return rejectCommand(room, command, nowMs, "NOT_ORGANIZER");
    if (room.phase !== "lobby" || room.quiz.status !== "waiting" || command.questionCount !== 10) {
      return rejectCommand(room, command, nowMs, "INVALID_QUIZ_STATE");
    }
    const scores = Object.fromEntries(Object.keys(room.members).map((id) => [id, 0]));
    return resolveSimpleEvent({ ...room, phase: "quiz", quiz: { ...room.quiz, scores } }, command, nowMs, {
      actorId: command.actorId,
      message: "Organizer started the 10-question quiz",
      type: "quiz_started",
    });
  }

  if (command.type === "open_quiz_question") {
    if (!isOrganizer) return rejectCommand(room, command, nowMs, "NOT_ORGANIZER");
    const canOpen = room.phase === "quiz"
      && ["waiting", "reveal"].includes(room.quiz.status)
      && command.questionIndex === room.quiz.completedQuestionCount
      && command.questionIndex < room.quiz.questionCount
      && command.questionId.length > 0
      && command.endsAt > nowMs;
    if (!canOpen) return rejectCommand(room, command, nowMs, "INVALID_QUIZ_STATE");
    const quiz = {
      ...room.quiz,
      correctOptionId: null,
      currentQuestionId: command.questionId,
      currentQuestionIndex: command.questionIndex,
      questionEndsAt: command.endsAt,
      revealEndsAt: null,
      status: "open" as const,
    };
    return resolveSimpleEvent({ ...room, quiz }, command, nowMs, {
      actorId: command.actorId,
      message: `Question ${command.questionIndex + 1} opened`,
      type: "quiz_question_opened",
    });
  }

  if (command.type === "score_quiz_question") {
    if (!isOrganizer) return rejectCommand(room, command, nowMs, "NOT_ORGANIZER");
    if (room.phase !== "quiz" || room.quiz.status !== "closed" || room.quiz.currentQuestionId !== command.questionId) {
      return rejectCommand(room, command, nowMs, "INVALID_QUIZ_STATE");
    }
    const scores = { ...room.quiz.scores };
    for (const memberId of Object.keys(room.members)) {
      scores[memberId] = (scores[memberId] ?? 0) + (command.outcomes[memberId] === true ? 1 : 0);
    }
    const quiz = {
      ...room.quiz,
      completedQuestionCount: room.quiz.completedQuestionCount + 1,
      correctOptionId: command.correctOptionId,
      questionEndsAt: null,
      revealEndsAt: command.revealEndsAt,
      scores,
      status: "reveal" as const,
    };
    return resolveSimpleEvent({ ...room, quiz }, command, nowMs, {
      actorId: command.actorId,
      message: `Question ${room.quiz.currentQuestionIndex + 1} scored`,
      type: "quiz_question_scored",
    });
  }

  if (command.type === "complete_quiz") {
    if (!isOrganizer) return rejectCommand(room, command, nowMs, "NOT_ORGANIZER");
    if (room.phase !== "quiz" || room.quiz.status !== "reveal" || room.quiz.completedQuestionCount !== 10) {
      return rejectCommand(room, command, nowMs, "INVALID_QUIZ_STATE");
    }
    const members = { ...room.members };
    const stats = { ...room.stats };
    for (const [memberId, member] of Object.entries(members)) {
      const correctAnswers = room.quiz.scores[memberId] ?? 0;
      members[memberId] = {
        ...member,
        correctAnswers,
        quizCompleted: true,
        readiness: "customizing",
        totalQuestions: 10,
        updatedAt: nowMs,
      };
      stats[memberId] = deriveBattleLoadout({ correctAnswers, totalQuestions: 10 });
    }
    const nextRoom: WarRoomState = {
      ...room,
      members,
      phase: "quiz-results",
      quiz: { ...room.quiz, revealEndsAt: null, status: "completed" },
      stats,
    };
    return resolveSimpleEvent(nextRoom, command, nowMs, {
      actorId: command.actorId,
      message: "Quiz completed and battle stats created",
      type: "quiz_completed",
    });
  }

  if (command.type === "start_battle_setup") {
    if (!isOrganizer) return rejectCommand(room, command, nowMs, "NOT_ORGANIZER");
    if (room.phase !== "quiz-results" || room.quiz.status !== "completed") {
      return rejectCommand(room, command, nowMs, "INVALID_PHASE");
    }
    return resolveSimpleEvent({ ...room, phase: "arena-setup" }, command, nowMs, {
      actorId: command.actorId,
      message: "Organizer moved the room to battle setup",
      type: "battle_setup_started",
    });
  }

  if (command.type === "select_character") {
    if (!actor) return rejectCommand(room, command, nowMs, "ACTOR_NOT_MEMBER");
    if (!actor.quizCompleted) return rejectCommand(room, command, nowMs, "QUIZ_NOT_COMPLETE");
    if (!["quiz-results", "arena-setup", "positioning"].includes(room.phase)) {
      return rejectCommand(room, command, nowMs, "INVALID_PHASE");
    }
    const nextRoom: WarRoomState = {
      ...room,
      members: { ...room.members, [actor.id]: { ...actor, position: null, readiness: "positioning", selection: command.selection, updatedAt: nowMs } },
    };
    return resolveSimpleEvent(nextRoom, command, nowMs, {
      actorId: actor.id,
      message: `${actor.nickname} selected a character`,
      type: "character_selected",
    });
  }

  if (command.type === "lock_position") {
    if (!actor) return rejectCommand(room, command, nowMs, "ACTOR_NOT_MEMBER");
    if (!actor.quizCompleted) return rejectCommand(room, command, nowMs, "QUIZ_NOT_COMPLETE");
    if (!actor.selection || room.phase !== "positioning") return rejectCommand(room, command, nowMs, "INVALID_PHASE");
    const { x, z } = command.position;
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) > room.arena.radiusM) {
      return rejectCommand(room, command, nowMs, "INVALID_POSITION");
    }
    const overlaps = Object.values(room.members).some((member) =>
      member.id !== actor.id && member.position && distanceBetween(command.position, member.position) < MINIMUM_PLAYER_DISTANCE_M);
    if (overlaps) return rejectCommand(room, command, nowMs, "INVALID_POSITION");
    const nextRoom: WarRoomState = {
      ...room,
      members: { ...room.members, [actor.id]: { ...actor, position: command.position, readiness: "waiting", updatedAt: nowMs } },
    };
    return resolveSimpleEvent(nextRoom, command, nowMs, {
      actorId: actor.id,
      message: `${actor.nickname} locked a battle position`,
      type: "position_locked",
    });
  }

  if (command.type === "set_arena_ready") {
    if (!isOrganizer) return rejectCommand(room, command, nowMs, "NOT_ORGANIZER");
    if (!Number.isFinite(command.radiusM) || command.radiusM < 2 || command.radiusM > 12) {
      return rejectCommand(room, command, nowMs, "INVALID_ARENA");
    }
    if (room.phase !== "arena-setup") return rejectCommand(room, command, nowMs, "INVALID_PHASE");
    return resolveSimpleEvent({
      ...room,
      arena: { radiusM: command.radiusM, scannedAt: nowMs, status: "ready" },
      phase: "positioning",
    }, command, nowMs, {
      actorId: command.actorId,
      message: `Organizer locked a ${command.radiusM.toFixed(1)} m arena`,
      type: "arena_ready",
    });
  }

  if (command.type === "start_battle") {
    if (!isOrganizer) return rejectCommand(room, command, nowMs, "NOT_ORGANIZER");
    if (room.phase !== "positioning") return rejectCommand(room, command, nowMs, "INVALID_PHASE");
    if (room.arena.status !== "ready") return rejectCommand(room, command, nowMs, "ARENA_NOT_READY");
    const combatants = Object.values(room.members).filter((member) => member.combatIncluded);
    const ready = combatants.length >= MINIMUM_BATTLE_PARTICIPANTS && combatants.every(
      (member) => member.connected && member.quizCompleted && member.selection && member.position && member.readiness === "waiting",
    );
    if (!ready) return rejectCommand(room, command, nowMs, "PARTICIPANTS_NOT_READY");
    const stats = { ...room.stats };
    for (const member of combatants) {
      const loadout = memberLoadout(room, member.id);
      if (!loadout) return rejectCommand(room, command, nowMs, "QUIZ_NOT_COMPLETE");
      stats[member.id] = loadout;
    }
    return resolveSimpleEvent({
      ...room,
      battleEndsAt: nowMs + command.durationMs,
      battleStartsAt: nowMs,
      phase: "battle",
      results: null,
      stats,
    }, command, nowMs, {
      actorId: command.actorId,
      message: `Battle started with ${combatants.length} combatants`,
      type: "battle_started",
    });
  }

  if (command.type === "attack") {
    if (room.phase !== "battle" || room.battleEndsAt === null || nowMs >= room.battleEndsAt) {
      return rejectCommand(room, command, nowMs, "BATTLE_NOT_ACTIVE");
    }
    if (!actor || !actor.position || !actor.connected || !actor.combatIncluded) {
      return rejectCommand(room, command, nowMs, "ACTOR_NOT_MEMBER");
    }
    if (!normalizeAimDirection(command.dirX, command.dirZ)) {
      return rejectCommand(room, command, nowMs, "ATTACK_INVALID_DIRECTION");
    }
    const attackerStats = memberLoadout(room, actor.id);
    if (!attackerStats) return rejectCommand(room, command, nowMs, "QUIZ_NOT_COMPLETE");
    const candidates = Object.values(room.members)
      .filter((member) => member.id !== actor.id && member.combatIncluded && member.position && !room.stats[member.id]?.eliminated)
      .map((member) => ({ id: member.id, position: member.position! }));
    const hit = findNearestAimTarget(actor.position, command.dirX, command.dirZ, candidates, command.weaponId);

    if (!hit) {
      const use = consumeWeaponUse(attackerStats, command.weaponId, nowMs);
      if (use.status === "rejected") return rejectCommand(room, command, nowMs, `ATTACK_${use.code}`);
      const nextRoom = { ...completeCommand(room, command, nowMs), stats: { ...room.stats, [actor.id]: use.attacker } };
      const missed = appendEvent(nextRoom, command, nowMs, {
        actorId: actor.id,
        message: `${actor.nickname} fired and missed`,
        type: "attack_missed",
        weaponId: command.weaponId,
      });
      return { eventIds: [missed.eventId], room: missed.room, status: "applied" };
    }

    const target = room.members[hit.targetId];
    const targetStats = memberLoadout(room, hit.targetId);
    if (!target || !targetStats) return rejectCommand(room, command, nowMs, "TARGET_NOT_MEMBER");
    const attack = resolveAttack({ attacker: attackerStats, nowMs, target: targetStats, weaponId: command.weaponId });
    if (attack.status === "rejected") return rejectCommand(room, command, nowMs, `ATTACK_${attack.code}`);
    let nextRoom: WarRoomState = {
      ...completeCommand(room, command, nowMs),
      stats: { ...room.stats, [actor.id]: attack.attacker, [target.id]: attack.target },
    };
    const applied = appendEvent(nextRoom, command, nowMs, {
      actorId: actor.id,
      damage: attack.damage,
      message: `${actor.nickname} hit ${target.nickname} for ${attack.damage.amount}`,
      targetId: target.id,
      type: "attack_applied",
      weaponId: command.weaponId,
    });
    nextRoom = applied.room;
    const eventIds = [applied.eventId];
    const alive = Object.entries(nextRoom.stats).filter(([id, stats]) => nextRoom.members[id]?.combatIncluded && !stats.eliminated && stats.hp > 0);
    if (alive.length <= 1) {
      nextRoom = finishBattle(nextRoom, nowMs);
      const completed = appendEvent(nextRoom, command, nowMs, {
        actorId: actor.id,
        message: alive.length === 1 ? `${nextRoom.members[alive[0][0]].nickname} won the battle` : "Battle ended without a survivor",
        type: "battle_completed",
      });
      nextRoom = completed.room;
      eventIds.push(completed.eventId);
    }
    return { eventIds, room: nextRoom, status: "applied" };
  }

  if (command.type === "end_battle") {
    if (!isOrganizer) return rejectCommand(room, command, nowMs, "NOT_ORGANIZER");
    if (room.phase !== "battle") return rejectCommand(room, command, nowMs, "BATTLE_NOT_ACTIVE");
    return resolveSimpleEvent(finishBattle(room, nowMs), command, nowMs, {
      actorId: command.actorId,
      message: `Battle completed: ${command.reason}`,
      type: "battle_completed",
    });
  }

  return rejectCommand(room, command, nowMs, "UNSUPPORTED_COMMAND");
}
