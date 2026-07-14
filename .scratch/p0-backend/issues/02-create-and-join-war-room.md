# 02 — Create and join a nickname-only War Room

**What to build:** An organizer can create a room and receive a four-digit code, then participants can join that exact room with only a nickname and observe the authoritative lobby roster.

**Blocked by:** 01 — Boot the P0 realtime server.

**Status:** ready-for-agent

- [ ] Creating room type `war` allocates a cryptographically random, unique four-digit Colyseus `roomId` through Presence.
- [ ] Allocation tries at most 100 candidates and returns `ROOM_ID_EXHAUSTED` without introducing another identifier format.
- [ ] Room disposal releases its identifier for later reuse.
- [ ] The creating reservation becomes the separate non-combat organizer record; a join payload cannot claim organizer authority.
- [ ] `joinById` admits participants only while the room is joinable and rejects an invalid/expired code cleanly.
- [ ] Nicknames use NFKC normalization, whitespace trimming/collapse, control-character rejection, and a 1–20-code-point base length.
- [ ] Duplicate normalized names receive deterministic numeric suffixes while player IDs remain the true identifiers.
- [ ] Twelve participants plus one organizer can join; participant 13 receives `ROOM_FULL`.
- [ ] A retry cannot create a second participant record for the same reservation/session.
- [ ] Synchronized lobby state exposes the organizer connection and participant roster without tokens or role-claim input.
- [ ] No custom room-creation endpoint, seat-reservation endpoint, or second code registry exists.
- [ ] Integration tests exercise create, join-by-ID, collision/release, role tampering, duplicate names, retry, and capacity.
