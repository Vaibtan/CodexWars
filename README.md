# CodexWars

React Native multiplayer AR battle game. The app is organized as an npm
workspace so mobile, server, and shared game contracts can evolve separately.

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

Use Node 22.13 or newer (Expo SDK 57 requires Node 22.13+), then install from
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
