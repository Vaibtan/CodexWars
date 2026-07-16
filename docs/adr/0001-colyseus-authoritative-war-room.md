# ADR 0001: Use Colyseus as the sole P0 War Room authority

**Status:** Accepted
**Date:** 2026-07-16

## Context

CodexWars needs a low-latency classroom room for up to 12 nickname-only participants and one organizer. Live quiz timing, position validation, combat, disconnect handling, and results must have one trusted owner. The product does not need durable participant accounts or room recovery after a process restart in P0.

Direct Firebase Realtime Database writes from the mobile app created a second authority model in which organizer and participant devices could mutate gameplay state. Firebase Authentication and Firestore also introduced cloud setup and internet dependencies without satisfying a P0 requirement.

## Decision

Use one in-memory Colyseus `WarRoom` as the sole P0 authority.

- Colyseus matchmaking creates and joins four-digit rooms.
- Colyseus session/reconnection tokens provide short-lived room-session authentication; P0 has no user accounts.
- The server binds organizer and participant roles and never trusts a client-supplied role or player ID.
- Colyseus Schema publishes the recoverable public allow-list.
- Typed messages carry commands, acknowledgements, errors, and transient effects.
- The mobile app uses one adapter and never writes room state directly to a database.
- Firebase client, Admin SDK, rules, emulator configuration, and duplicate realtime reducers are removed.

## Consequences

- The demo runs on a laptop and LAN without internet or cloud credentials.
- A server-process restart ends active rooms; this is an explicit P0 limitation.
- Horizontal scaling requires shared Presence/Driver and a deployment design before multiple server processes are allowed.
- Durable organizer accounts, authored quizzes, analytics, or history require a future storage/auth ADR. That store may receive finalized product data, but it must not become live combat authority.
