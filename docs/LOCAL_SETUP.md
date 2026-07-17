# Local setup and run guide

This guide takes a teammate from a fresh checkout to a complete local CodexWars round. The backend and Metro can run on Windows, macOS, or Linux. Building and testing the AR client requires a native CodexWars development build on an ARCore-capable Android phone or an ARKit-capable iPhone.

## 1. Prerequisites

Install the following on the development machine:

- Git.
- Node.js `22.23.1`, as pinned by `.nvmrc` and the root `package.json`. The commands below use `nvm`; a direct installation of the exact version also works.
- npm 10 or newer.
- A phone and development machine on the same LAN or hotspot.

For Android local builds, also install:

- Android Studio and the Android SDK.
- Android SDK Platform Tools, with `ANDROID_HOME` configured and `platform-tools` on `PATH`.
- JDK 17.
- An ARCore-capable Android phone with USB debugging enabled.

For iPhone builds, use macOS with Xcode for a local build, or use EAS Build. Installing a development build on a physical iPhone requires Apple signing and device registration. A paid Apple Developer account is required for the team device workflow.

Expo Go is not supported. CodexWars uses Viro, ARCore, and ARKit native modules that are included in the CodexWars development client.

## 2. Install the workspace

Clone the repository, enter it, and select the pinned Node version:

```bash
git clone https://github.com/Vaibtan/CodexWars.git
cd CodexWars
nvm install 22.23.1
nvm use 22.23.1
node --version
npm --version
```

`node --version` must report `v22.23.1`. Install the committed workspace dependency tree from the repository root:

```bash
npm ci
```

Do not install dependencies separately inside the workspaces.

## 3. Configure device networking

The backend listens on port `4000` by default. A physical phone cannot use the mobile client's loopback default because `127.0.0.1` would point back to the phone.

Copy the mobile environment template:

PowerShell:

```powershell
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

macOS or Linux:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Find the development machine's LAN address with `ipconfig` on Windows, `ipconfig getifaddr en0` on macOS, or `hostname -I` on Linux. Edit `apps/mobile/.env` so the phone can reach that address:

```dotenv
EXPO_PUBLIC_REALTIME_SERVER_URL=http://192.168.1.10:4000
```

Replace the example address with the machine's current LAN address. Other supported targets are:

| Client | Backend URL |
|---|---|
| Physical Android or iPhone | `http://<development-machine-LAN-IP>:4000` |
| Android emulator | `http://10.0.2.2:4000` |
| iOS Simulator | `http://127.0.0.1:4000` |

Allow inbound TCP traffic on port `4000` through the host firewall. Never put `OPENAI_API_KEY` or any other secret in an `EXPO_PUBLIC_*` variable; Expo embeds those values in the client bundle.

Restart Metro after changing `apps/mobile/.env`.

## 4. Start and verify the backend

No provider credentials are required. Without `OPENAI_API_KEY`, the server starts in `fallback_only` mode and the curated quiz supports a complete offline round.

From the repository root:

```bash
npm run server
```

The terminal should report that the server is listening on `http://localhost:4000`. In another terminal, verify both operational endpoints:

PowerShell:

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:4000/ready
```

macOS or Linux:

```bash
curl --fail http://localhost:4000/health
curl --fail http://localhost:4000/ready
```

Both requests should succeed. A normal credential-free response reports `quizGeneration` as `fallback_only`; `/ready` reports `status` as `ready` after room registration.

### Optional generated quizzes

Quiz generation is server-only and is not needed for local gameplay. To enable it for the running server, provide the key only in the server terminal before starting the process.

PowerShell:

```powershell
$env:OPENAI_API_KEY = "your-key"
$env:QUIZ_GENERATION_ENABLED = "true"
npm run server
```

macOS or Linux:

```bash
export OPENAI_API_KEY="your-key"
export QUIZ_GENERATION_ENABLED=true
npm run server
```

The readiness response should then report `quizGeneration` as `generated`. Do not commit the key, expose it to the mobile app, or use a real-provider run casually because it incurs API cost.

## 5. Install the native development client

Install a development client once per native configuration. Rebuild it after changing Expo plugins, native dependencies, package identifiers, or Viro configuration. Ordinary TypeScript and asset changes only require Metro reloads.

### Android local build

Connect an Android phone with USB debugging enabled, confirm it appears in `adb devices`, and run from the repository root:

```bash
npm run android --workspace @codexwars/mobile -- --no-bundler
```

This generates the ignored native project, builds the development client, and installs `com.codexwars.app` on the selected device without starting a second Metro process. An emulator can validate non-AR screens but is not a substitute for physical ARCore testing.

### Android EAS build

For a shareable development build:

```bash
npm install --global eas-cli
eas login
cd apps/mobile
eas build --platform android --profile development
```

Install the resulting build on each test phone.

### iPhone local or EAS build

On macOS, a locally signed build can be created with:

```bash
npm run ios --workspace @codexwars/mobile -- --no-bundler
```

For the team's physical-device EAS workflow:

```bash
npm install --global eas-cli
eas login
cd apps/mobile
eas build --platform ios --profile development
```

Follow the EAS prompts for Apple signing and device registration, then install the result on the registered iPhone. The `development-simulator` profile is for an iOS Simulator and cannot be installed on a physical phone.

## 6. Start the mobile app

Keep the backend running. From a second terminal at the repository root, start Metro:

```bash
npm run mobile
```

Open the installed CodexWars development client on every device and connect it to the displayed Metro server. All devices must run a development build compatible with the current checkout.

If Metro has stale configuration or bundle state, restart it with:

```bash
npm run start --workspace @codexwars/mobile -- --clear
```

## 7. Run a local multiplayer round

1. Print [`output/pdf/codexwars-arena-marker-a4.pdf`](../output/pdf/codexwars-arena-marker-a4.pdf) at 100% or Actual size. Confirm the black square is 180 mm wide.
2. Open CodexWars on the organizer phone and create a room.
3. Open CodexWars on at least two participant phones, join with the four-digit room code, and use distinct nicknames.
4. Prepare the curated fallback quiz, or prepare and approve a generated quiz when server-only generation is enabled.
5. Start the quiz and have every participant complete it.
6. Place the marker on a flat, well-lit floor. Each participant scans the same marker, locks a safely spaced position, and becomes ready.
7. Start the countdown from the organizer device and play the 60-second battle.
8. Confirm standings appear, then reset the room and verify another round can begin.

Keep participants stationary and safely spaced. CodexWars performs local camera tracking and does not upload camera frames.

## 8. Verify the checkout

Before handing the setup to another teammate, run from the repository root:

```bash
npm run typecheck
npm test
npm run test:secrets
npm run test:bundle:android --workspace @codexwars/mobile
npx expo-doctor apps/mobile
```

These checks validate the TypeScript workspaces, deterministic behavior, secret scan, Android JavaScript bundle, and Expo dependency alignment. They do not replace the physical mixed-platform AR checks in [`PLATFORM_TESTING.md`](PLATFORM_TESTING.md) and [`M0_RESULTS.md`](../M0_RESULTS.md).

## 9. Troubleshooting

### The app cannot reach the backend

- Confirm `/health` works on the development machine.
- Open `http://<development-machine-LAN-IP>:4000/health` from the phone's browser.
- Recheck `apps/mobile/.env`, then restart Metro.
- Confirm the phone and host are on the same network and that the firewall allows port `4000`.
- Avoid guest Wi-Fi networks that isolate clients from one another.

### Expo Go reports an incompatible project or a native module is missing

Open the installed CodexWars development client, not Expo Go. Rebuild the client if the native configuration changed or if it was built from an incompatible checkout.

### Metro is reachable but the bundle is stale

Stop Metro and run `npm run start --workspace @codexwars/mobile -- --clear`. Reload the development client after Metro is ready.

### Android build cannot find Java, the SDK, or the phone

- Confirm `java -version` reports JDK 17.
- Confirm `ANDROID_HOME` points to the Android SDK.
- Confirm `adb devices` lists the phone as `device`, not `unauthorized`.
- Accept the USB debugging prompt on the phone and retry.

### AR does not acquire the marker

- Use a physical ARCore- or ARKit-capable phone.
- Print at Actual size and verify the 180 mm black square.
- Use even lighting, keep the full marker visible during acquisition, and avoid glare.
- Continue with the measurement procedure in [`PLATFORM_TESTING.md`](PLATFORM_TESTING.md) and [`AR_IMPLEMENTATION_SPEC.md`](AR_IMPLEMENTATION_SPEC.md).
