# CodexWars

React Native multiplayer AR battle game. The app is organized as an npm
workspace so mobile, server, and shared game contracts can evolve separately.

## Specification map

Each decision has one authoritative home:

| Document | Owns |
|---|---|
| [`PRD.md`](PRD.md) | Product outcomes, roles, game rules, scope, and acceptance criteria |
| [`BUILD_SPEC.md`](BUILD_SPEC.md) | Pinned stack, development environment, repository shape, and milestone order |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Component boundaries, runtime flows, state ownership, and invariants |
| [`API_AND_REALTIME_SPEC.md`](API_AND_REALTIME_SPEC.md) | Exact P0 admission, synchronized state, commands, events, errors, and reconnect contract |
| [`docs/AR_IMPLEMENTATION_SPEC.md`](docs/AR_IMPLEMENTATION_SPEC.md) | Marker/pose adapter and GLB rendering/asset contract |

Supporting research and testing guides are evidence or procedure, not competing
sources of truth. The material under `docs/archive/` is historical only.

Backend implementation work is sequenced in the
[`P0 backend checklist`](docs/BACKEND_IMPLEMENTATION_CHECKLIST.md).

```text
apps/
  mobile/             Expo / React Native client
    src/
      ar/             ARKit/ARCore renderer boundary (Viro goes here later)
      components/     reusable React Native UI
      config/         client configuration
      features/       quiz, lobby, battle features
      lib/             client utilities
      navigation/     navigation setup
      screens/        app screens
      store/          client state
  server/             Node.js game API and realtime room server
    src/
      config/         server configuration
      middleware/     transport middleware
      routes/         HTTP endpoints
      services/       room and game services
      types/          backend-only types
packages/
  shared/             cross-platform domain and protocol types
```

## First run

Use Node 22.23.1 (pinned in `.nvmrc` and the EAS profiles), then install from
the repository root:

```bash
npm install
npm run mobile
```

Open the Expo development menu and launch the Android, iOS, or web target. The
first screen is intentionally non-AR; AR/Viro will require a native development
build later. Run the starter backend separately with `npm run server`; its
health endpoint is `http://localhost:4000/health`.

For the iPhone-on-macOS and Android-on-Windows development-build workflow, see
[`docs/PLATFORM_TESTING.md`](docs/PLATFORM_TESTING.md).
