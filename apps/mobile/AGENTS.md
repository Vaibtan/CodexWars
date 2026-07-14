# CodexWars mobile app guide

`apps/mobile` is the shared Expo/React Native client for iOS and Android. Keep
product and game code platform-neutral: screens, state, networking, and shared
types belong in TypeScript; platform differences belong in Expo configuration
and development-build setup.

## Before changing code

- Use Node 22.23.1: from the repository root, run `nvm use`.
- Install dependencies from the repository root with `npm install`.
- Read the Expo SDK 57 documentation before changing Expo configuration or
  adding a native module. Use `npx expo install <package>` rather than a plain
  `npm install` for Expo/RN native packages, so Expo selects SDK-compatible
  versions.
- ViroReact is installed for the M0 AR scaffold. Keep every Viro import inside
  `src/ar/`; Expo Go cannot run this app, so use a native development client.

## Structure and ownership

```text
src/
  ar/           ARKit/ARCore presentation boundary; only Viro imports here
  components/   reusable platform-neutral UI
  config/       app configuration
  features/     domain features such as lobby, quiz, and battle
  lib/          client utilities
  navigation/   navigation setup
  screens/      thin screen composition
  store/        client state
  types/        mobile-only types
```

The server owns rooms, locked positions, combat, HP, and results. The AR layer
publishes only marker-relative position/aim data and renders server-synced
state. Do not put hit detection, authoritative state mutation, or direct
network calls in `src/ar/`.

## Run the first screen

From the repository root:

```bash
nvm use
npm install
npm run mobile
```

Use the Expo terminal controls to open a web browser, Android device/emulator,
or iOS simulator/device. Run the local backend separately when needed:

```bash
npm run server
```

The health endpoint is `http://localhost:4000/health`.

## Windows + Android

1. Install Node 22, Android Studio, Android SDK Platform Tools, and JDK 17.
2. Set `ANDROID_HOME` and add Android `platform-tools` to `PATH`.
3. Use a physical ARCore-capable Android device for AR work; emulators are not
   an AR tracking substitute.
4. Install the shared development build created by:

   ```bash
   cd apps/mobile
   eas build --platform android --profile development
   ```

6. Keep the phone and Metro host on the same LAN/hotspot. Do not hardcode a
   laptop IP address in source code.

## macOS + iPhone

1. Install Node 22, Xcode, Command Line Tools, and an Expo account.
2. A physical iPhone build through EAS requires a paid Apple Developer account
   for signing and device registration.
3. Expo Go cannot load ViroReact. Build the development client:

   ```bash
   cd apps/mobile
   eas build --platform ios --profile development
   ```

4. Install the resulting build on the registered iPhone, then start Metro from
   the repository root with `npm run mobile` and open the development client.
5. `development-simulator` is only for an iOS Simulator; it cannot be installed
   on a physical iPhone.

## Platform alignment rules

- `app.json` holds the shared iOS bundle identifier and Android package name.
  Keep both aligned; update them together only before first signing if the team
  chooses a different owned reverse-domain identifier.
- `eas.json` defines development, simulator, preview, and production profiles.
  Do not weaken the `developmentClient` profile once AR dependencies exist.
- This is an Expo managed/CNG app. Do not hand-edit generated `ios/` or
  `android/` folders; they are ignored by Git and regenerated from Expo config.
- Test every AR change on one physical iPhone and one physical Android phone
  before merging. Validate marker acquisition, tracking loss, GLB load,
  rendering performance, and gameplay parity.

## Checks before handoff

From the repository root, run:

```bash
npm run typecheck
npm test
```

Consult `docs/PLATFORM_TESTING.md` for the full cross-platform release gate and
`docs/AR_IMPLEMENTATION_SPEC.md` for the AR/game architecture contract.
