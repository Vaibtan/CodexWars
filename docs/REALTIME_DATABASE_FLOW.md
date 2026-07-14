# Firebase War Room flow

CodexWars uses Firestore for durable quiz templates and Realtime Database (RTDB) for one live War Room projection. The organizer device is the hackathon authority: participants publish constrained answers and commands, and the organizer resolves every command in an RTDB transaction through the shared pure state machine.

## Product phase flow

`lobby → quiz → quiz-results → arena-setup → positioning → battle → results`

1. The organizer creates a six-digit room and waits in `lobby` while participants join with a name and explicitly toggle `quiz-ready`. The quiz cannot start until every included participant is online and ready.
2. The organizer starts the fixed ten-question quiz, opens each question, closes it, reads private answers, publishes correctness outcomes, and advances. Participants can submit only one answer; they see correctness and the exact battle-stat delta, but only the organizer advances the shared question index.
3. Completing question ten derives `BattleLoadout` for every participant and moves to `quiz-results`.
4. The organizer moves to `arena-setup`. Participants may customize while the organizer scans.
5. Locking the arena moves to `positioning`; participants lock one marker-relative `(x,z)` position.
6. Once every included participant is connected, customized, positioned, and waiting, the organizer starts `battle`.
7. Attack commands contain a weapon and floor-plane direction. The authority chooses the nearest ray-circle intersection, applies shield before HP, and logs a miss or hit. Zero HP eliminates a participant.
8. Last survivor, timer expiry, or organizer termination creates immutable standings and moves to `results`.

## RTDB tree

```text
roomDirectory/{code}
  roomId, organizerId, createdAt

warRooms/{roomId}
  organizerId, organizerName, code, phase, roundId, revision
  quiz/
    status, questionCount, currentQuestionId, currentQuestionIndex
    questionEndsAt, revealEndsAt, correctOptionId
    completedQuestionCount, scores/{participantId}
  arena/
    status, radiusM, scannedAt
  members/{participantId}/
    nickname, connected, combatIncluded, quizCompleted
    correctAnswers, totalQuestions, selection, position, readiness
  stats/{participantId}/
    hp, shield, weapons, abilities, eliminated
  commands/{commandId}/
    actorId, type, roundId, createdAt, status, payload...
  events/{sequence_commandId}/
    sequence, revision, type, actorId, targetId, damage, message
  results/
    winnerId, completedAt, standings/{participantId}

quizAnswers/{roomId}/{questionId}/{participantId}
  participantId, optionId, submittedAt
```

Quiz content and answer keys live in Firestore, not the public War Room. A participant can create exactly one private answer while that question is open. Closing a question is an organizer transaction that stops further writes before answers are read. The public room receives only the correct option during reveal, per-participant correctness, aggregate scores, and derived stats.

## Write ownership

| Data | Participant | Organizer authority |
|---|---|---|
| Own presence | Connect/disconnect only | May reconcile as part of room transaction |
| Private quiz answer | Create once while open | Read after closing question |
| Commands | Join, lobby readiness, character, position, attack | All orchestration commands |
| Phase, quiz score, stats, HP, results | No direct write | Transactional write |
| Events and command status | No direct write | Transactional append/resolve |

Security rules constrain the permitted paths and command kinds. They cannot make an organizer-owned mobile device cheat-proof; moving the same `resolveWarRoomCommand` function to Cloud Functions or a trusted service is the production hardening path.

## Mobile integration seam

Incoming screens should depend on `WarRoomRealtimeClient`, not Firebase primitives. Its surface is intentionally small:

```ts
const client = await createOrganizerWarRoom(name);
const unsubscribe = client.subscribe(renderSnapshot);
await client.send({ type: "start_quiz" });
await client.send({ type: "open_quiz_question", questionId, questionIndex, endsAt });
```

`createOrganizerWarRoom` and `joinParticipantWarRoom` return the same interface. `send(intent)` covers every flow action, `subscribe` supplies the current projection, and `dispose` removes listeners. This keeps screen navigation and presentation independent from Firebase paths and transaction mechanics.

## Consistency invariants

- Room commands are idempotent: only `pending` commands resolve, and retries return the existing resolution.
- Every authoritative mutation increments `revision`; every action event increments `eventSequence`.
- Exactly ten scored questions are required before battle stats exist.
- Quiz progression is organizer-owned; participant answer writes never move the current question.
- Quiz start requires at least one participant and every included participant to be connected with `readiness = quiz-ready`.
- Character choice is cosmetic and never influences targeting or stats.
- Locked positions must remain inside the arena and at least 1.5 m apart.
- A client-predicted target never decides a hit; only normalized direction and authoritative positions do.
- A valid miss consumes the same cooldown/charge as a hit.
- Results are derived from authoritative final stats and stored with the room.
