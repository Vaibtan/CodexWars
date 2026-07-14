# CodexWars

React Native multiplayer AR battle game. The app is organized as an npm
workspace so mobile, server, and shared game contracts can evolve separately.

```text
apps/
  mobile/             Expo / React Native client
    src/
      ar/             Viro ARKit/ARCore scenes and native renderer boundary
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

Use Node 22.13 or newer, then install from
the repository root:

```bash
npm install
npm run mobile
```

Install the native development client first, then run `npm run mobile` and open
that client on an iPhone or Android device. Viro is a native dependency, so
Expo Go cannot load this app. Run the starter backend separately with
`npm run server`; its health endpoint is `http://localhost:4000/health`.

For the iPhone-on-macOS and Android-on-Windows development-build workflow, see
[`docs/PLATFORM_TESTING.md`](docs/PLATFORM_TESTING.md).
