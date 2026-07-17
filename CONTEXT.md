# CodexWars Domain Language

CodexWars turns a synchronous quiz into a colocated arena battle. This glossary fixes the product terms used across the PRD, technical specifications, protocol, and implementation.

## Session and roles

**War Room**:
The live, War Room-authoritative session that contains one organizer, its participants, one quiz run, arena setup, and one battle.
_Avoid_: Game session, lobby room, quiz room

**Organizer**:
The person who creates and controls a War Room. The organizer participates in room coordination but is not a combat participant.
_Avoid_: Host, admin, teacher account

**Participant**:
A person admitted to a War Room to answer the quiz. A participant may be included in combat or designated quiz-only.
_Avoid_: Student account, player when combat inclusion is unknown

**Combat Participant**:
A participant included in the battle and therefore required to localize, lock a position, and become ready before battle start.
_Avoid_: Active player, included user

**Quiz-only Participant**:
A participant who completes the quiz but is excluded from localization, positioning, battle readiness, and combat.
_Avoid_: Observer, spectator

## Quiz

**Quiz Template**:
An immutable, validated set of ten questions, options, answer keys, explanations, evidence, and time limits. A template is either organizer-approved generated content or the curated fallback and is frozen before a Quiz Run.
_Avoid_: Quiz session, question bank

**Quiz Preparation**:
The pre-game server process that converts bounded organizer configuration into a validated generated or fallback Quiz Template. It includes generation, web grounding, review, budgets, cancellation, and fallback selection but never runs during a Quiz Run.
_Avoid_: Live quiz generation, client prompt, question streaming

**Quiz Run**:
The occurrence of a Quiz Template inside one War Room for a frozen participant cohort.
_Avoid_: Quiz, game, session

**Answer Submission**:
A participant's single accepted option for one question in one Quiz Run.
_Avoid_: Answer result, response event

**Quiz Result**:
A participant's finalized correct-answer count and the battle reward derived from it.
_Avoid_: Battle result, score event

**Reveal**:
The organizer-timed interval after a question closes when its correct option and explanation become public to the War Room.
_Avoid_: Answer check, grading screen

## Arena and battle

**Character**:
A cosmetic GLB representation and approved appearance variant selected for a participant. A Character never changes targeting, hit radius, HP, shield, damage, cooldown, range, or charges.
_Avoid_: Class, hero, loadout

**Battle Stats**:
The War Room-authoritative gameplay values for a participant, including HP, shield, weapon, charges, cooldown, and elimination state. Battle Stats are independent of Character.
_Avoid_: Character stats

**Locked Position**:
A validated, stationary participant location on the marker-relative two-dimensional floor plane.
_Avoid_: Live position, GPS position, 3D position

**Attack Request**:
A participant's discrete request to fire a weapon in a finite two-dimensional direction; the War Room validates and normalizes it before resolution.
_Avoid_: Hit, projectile, shot result

**Attack Resolution**:
The War Room's authoritative decision for an Attack Request, including target, damage, shield, HP, and combat revision.
_Avoid_: Client hit, collision event

**Battle Event**:
An immutable, ordered transient notification for countdown start, attack resolution, elimination, or battle completion within one War Room. Persistent readiness and combat values reconcile from synchronized state instead.
_Avoid_: Log message, client update, mutable action

**Battle Snapshot**:
The current authoritative projection of a War Room's phase, arena, participants, and Battle Stats that clients render and reconcile against.
_Avoid_: Local game state, battle cache

**Battle Result**:
The War Room-authoritative winner, completion reason, and final standings for one battle. It remains part of the War Room and is not durably persisted in P0.
_Avoid_: Quiz result, match history

**Standings**:
The ordered battle ranking derived from elimination order or, at timer expiry, remaining HP followed by quiz score.
_Avoid_: Leaderboard, persistent ranking
