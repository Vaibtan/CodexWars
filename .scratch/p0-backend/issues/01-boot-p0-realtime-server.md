# 01 — Boot the P0 realtime server

**What to build:** A developer can start the authoritative Colyseus service locally, observe reliable liveness/readiness responses, and run its smoke tests without Firebase credentials or internet access.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The server uses the pinned Colyseus 0.17 server/testing stack and starts on the configured port.
- [ ] `GET /health` returns `200` with service name, `status: "ok"`, and protocol version without inspecting rooms or external services.
- [ ] `GET /ready` returns `503` before room registration completes and `200` with protocol version after initialization.
- [ ] Unknown HTTP routes return a bounded JSON `404` response.
- [ ] Colyseus Schema patches are configured at 100 ms (10 Hz).
- [ ] The P0 server dependency graph and startup path contain no Firebase Admin import, initialization, configuration requirement, or network call.
- [ ] Existing Firebase-only tests/scaffolding are removed from the P0 runtime package or isolated outside its executable dependency graph.
- [ ] Automated tests prove liveness/readiness behavior and offline startup.
- [ ] Repository-wide backend typecheck and tests pass.
