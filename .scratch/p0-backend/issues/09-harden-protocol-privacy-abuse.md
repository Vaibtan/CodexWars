# 09 — Harden protocol, privacy, and abuse boundaries

**What to build:** The complete backend rejects malformed, stale, unauthorized, oversized, or abusive traffic predictably and exposes no student/session secrets through state, events, errors, or logs.

**Blocked by:** 08 — Handle battle disconnects without corrupting results.

**Status:** ready-for-agent

- [ ] Every matchmaking option, command, event, and synchronized projection has shared runtime validation in addition to TypeScript types.
- [ ] Unsupported protocol versions fail before creating a room-member record.
- [ ] Unknown fields on authority-sensitive commands reject without mutation.
- [ ] Every handler resolves server-bound identity, then validates role, round/command identity, phase, payload, and domain invariants before mutation.
- [ ] Accepted command outcomes are retained per client/round up to 512 entries with no eviction; reaching the cap returns `RATE_LIMITED`.
- [ ] Room commands larger than 2 KiB reject before domain handling.
- [ ] Quiz answers allow one accepted and at most five malformed attempts per participant/question.
- [ ] Localization/position/readiness traffic is capped at five attempts per second; raw attack traffic at ten per second in addition to weapon cooldown.
- [ ] Reconnected quiz participants recover the current question, deadline, and their own submission boolean without seeing another answer.
- [ ] Schema snapshots/events contain no reconnection token, role-claim input, selected option before reveal, unrevealed answer key, Firebase identifier, camera data, or AR pose.
- [ ] Client errors use stable codes and bounded details without stack traces or raw dependency messages.
- [ ] Logs redact nicknames, tokens, answer choices, and coordinates while retaining correlation ID, hashed room ID, player ID, event type, and error code.
- [ ] The complete round still boots and runs without Firebase configuration or internet access.
- [ ] Security/conformance tests prove authorization, phase/round rejection, bounds, throttles, redaction, and leak-free serialization.
