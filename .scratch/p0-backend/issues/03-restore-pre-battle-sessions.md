# 03 — Restore pre-battle sessions after network drops

**What to build:** A temporarily disconnected organizer or participant can resume the same pre-battle room identity, while expired rooms and intentional leaves terminate cleanly instead of creating duplicate members or endless retries.

**Blocked by:** 02 — Create and join a nickname-only War Room.

**Status:** ready-for-agent

- [ ] An unintentional participant drop marks the existing participant disconnected and clears readiness without deleting their record.
- [ ] A valid reconnection token reattaches to the same participant ID and restores current synchronized state.
- [ ] An intentional leave does not trigger automatic reconnection.
- [ ] A pre-countdown organizer drop disables organizer-only commands without changing the current phase.
- [ ] Organizer reconnection within 60 seconds restores the same organizer authority; grace expiry closes the room.
- [ ] Organizer authority never transfers automatically to a participant.
- [ ] A room expires after two hours without a successful join, reconnect, or accepted in-room command.
- [ ] Expired tokens, disposed rooms, and server restarts produce `SESSION_EXPIRED`/session-ended behavior rather than a new identity.
- [ ] Reconnection tokens never enter Schema state, application logs, or client-facing error details.
- [ ] Integration tests cover participant resume, organizer resume/expiry, intentional leave, idle expiry, and simulated restart.
