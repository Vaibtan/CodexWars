# Platform testing: iPhone and Android

CodexWars is one Expo/React Native application in `apps/mobile`. Platform
differences are isolated to Expo configuration and native development builds;
game screens, protocol types, and future AR presentation code remain shared.

## Shared platform contract

| Concern | Decision |
|---|---|
| App code | Shared TypeScript/React Native under `apps/mobile/src/` |
| App identity | `com.codexwars.app` for iOS and Android; change it once before first production signing if the team's registered reverse-domain identifier differs |
| Node runtime | Node 22.23.1, selected with `nvm use` from the repository root |
| Native workflow | Expo managed/CNG. Do not hand-edit generated `ios/` or `android/` directories. |
| App runtime | Uses the `development` build profile because Viro/ARKit/ARCore are native modules; Expo Go cannot load the app. |
| AR work | Print `output/pdf/codexwars-arena-marker-a4.pdf` at 100% and test the same marker with physical ARKit- and ARCore-capable devices. |

## iPhone testing — macOS owner

1. Install Xcode and sign in with the team's Apple Developer account.
2. From `apps/mobile`, install EAS CLI and authenticate: `npm install --global eas-cli && eas login`.
3. Create the native development client: `eas build --platform ios --profile development`.
4. Register/install the resulting build on the physical iPhone. EAS will guide signing and device registration.
5. On the same LAN, from the repository root run `nvm use && npm run mobile`, then open the development client and select the Metro server.

An iPhone device build on EAS needs a paid Apple Developer account. Use
`development-simulator` only for an iOS Simulator; it cannot be installed on a
physical iPhone.

## Android testing — Windows teammates

1. Install Node 22, Android Studio, JDK 17, and an Expo account/EAS CLI.
2. For the locally connected phone, create and install the development client from `apps/mobile` with `npx expo run:android`. For a shared remote build, use `eas build --platform android --profile development`.
3. Confirm the installed package is `com.codexwars.app`, not Expo Go.
4. Run `npm run mobile` on the machine hosting Metro. Devices must reach that
machine over the same LAN/hotspot; use Expo's tunnel option only when LAN is
unavailable.

The Viro native module is already installed, so use the development client even
when testing the non-AR home screen.

## Cross-platform release gate

Before merging any AR feature, test the same commit on one physical iPhone and
one ARCore-capable Android phone:

- app starts and connects to Metro/backend on the selected LAN;
- marker acquisition and tracking-loss recovery work;
- GLB asset loads and animation plays;
- marker-relative position and aim produce matching server results;
- no platform-specific UI/permission or performance regression appears.

Record the exact phones, OS versions, commit, ten acquisition trials, cross-device point agreement, heading error, three-minute drift, stale-pose shutdown, and GLB results in `M0_RESULTS.md`. Do not mark M0 passed from an emulator, a single platform, or a build-only check.
