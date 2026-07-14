# CodexWars — Retired v1 Developer Setup

> **Do not use this setup guide.** It configures the retired Cloud Anchor/Cloud Run approach. Use `BUILD_SPEC.md` v1.2 for the active marker-based build, including the required Android-and-iOS P0 device setup.

This is the day-before setup guide for the four-person CodexWars hackathon team.

CodexWars uses:

- React Native with Expo development builds
- ViroReact for AR rendering
- TypeScript across the client and backend
- Colyseus for real-time rooms and battle state
- Google ARCore Cloud Anchors for shared spatial alignment
- Google Cloud Run for the backend
- Google Cloud CLI and Cloud Run MCP for deployment, testing, logs, and service inspection

> **Important:** Google Cloud SDK and Google Cloud CLI refer to the same toolchain. Install the **Google Cloud CLI** once; it includes `gcloud`, `gsutil`, and `bq`.

## 1. Recommended Versions

To minimize hackathon-day compatibility problems, everyone should use the same major versions.

| Tool | Recommended version |
|---|---:|
| Node.js | 22 LTS, preferably 22.13 or newer |
| npm | Version bundled with Node 22 |
| Git | Latest stable |
| Expo SDK | 56 |
| React Native | 0.85 |
| ViroReact | 2.57.2 |
| Java/JDK | 17 |
| Android SDK Platform | 36 |
| Android Build Tools | 36.0.0 |
| Xcode | 26.4 or newer for Expo SDK 56 |
| Google Cloud CLI | Latest stable |

Commit the package lockfile and always install repository dependencies with:

```bash
npm ci
```

Do not independently upgrade Expo, React Native, ViroReact, or native packages during the hackathon.

## 2. Team Installation Matrix

| Developer role | Required laptop setup | Required device |
|---|---|---|
| AR/mobile lead | macOS, Android toolchain, Xcode toolchain, Google Cloud CLI | One ARCore Android phone and one ARKit iPhone |
| Backend/realtime lead | Node.js, Git, Google Cloud CLI, Cloud Run MCP, Docker optional | Phone optional |
| Battle/UI developer | Windows or macOS, Android toolchain, Google Cloud CLI | ARCore Android phone |
| Organizer/quiz developer | Windows or macOS, Android toolchain, Google Cloud CLI | ARCore Android phone |

Only the AR/mobile lead needs a Mac and iPhone toolchain. Every developer should install Google Cloud CLI so anyone can inspect the deployed backend, subject to their IAM permissions.

## 3. Tools Required on Every Laptop

Install these regardless of operating system:

- [Git](https://git-scm.com/downloads)
- [Node.js 22 LTS](https://nodejs.org/en/download)
- npm, included with Node.js
- VS Code, Cursor, or another shared editor
- Google Cloud CLI
- A GitHub account with repository access
- A Google account added to the CodexWars Google Cloud project
- A modern browser
- A USB data cable for the developer's test phone

Recommended editor extensions:

- ESLint
- Prettier
- React Native Tools
- GitLens, optional

Verify the common installation:

```bash
node --version
npm --version
git --version
gcloud --version
```

## 4. Windows and Android Setup

### Required software

1. Install [Android Studio](https://developer.android.com/studio).
2. During setup, install:
   - Android SDK Platform 36
   - Android SDK Build-Tools 36.0.0
   - Android SDK Platform-Tools
   - Android SDK Command-line Tools, latest
   - Google USB Driver on Windows
3. Install JDK 17 if Android Studio has not provided a compatible runtime.

Android Studio is strongly recommended because it provides the SDK Manager, device tools, Gradle diagnostics, and an easy way to repair the Android SDK. The application can still be coded in VS Code or Cursor.

### Environment variables

Set:

```text
ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
```

Add these directories to `PATH`:

```text
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
%ANDROID_HOME%\cmdline-tools\latest\bin
```

If a separately installed JDK is used, set `JAVA_HOME` to the JDK 17 directory.

Restart the terminal after changing environment variables, then verify:

```powershell
java -version
adb --version
adb devices
```

### Android phone preparation

Use a physical, [ARCore-supported Android device](https://developers.google.com/ar/devices).

On the phone:

1. Update **Google Play Services for AR** from the Play Store.
2. Enable Developer Options.
3. Enable USB debugging.
4. Connect using a USB data cable.
5. Accept the computer authorization prompt.
6. Confirm that `adb devices` shows the device as `device`, not `unauthorized`.

An Android emulator is not the primary test target for CodexWars AR. Use a physical phone.

## 5. macOS, iPhone, and Android Setup

The AR/mobile lead should install both the iOS and Android toolchains on the Mac.

### Required macOS tools

- [Xcode](https://apps.apple.com/app/xcode/id497799835)
- Xcode Command Line Tools
- [Homebrew](https://brew.sh/)
- Node.js 22
- Watchman
- CocoaPods
- JDK 17
- Android Studio with the Android components listed above

Example Homebrew installation:

```bash
xcode-select --install
brew install node@22 watchman cocoapods
brew install --cask zulu@17
```

If `node@22` is not linked automatically, follow the linking instructions printed by Homebrew.

Verify:

```bash
node --version
watchman --version
pod --version
xcodebuild -version
xcode-select -p
java -version
adb --version
```

### Xcode preparation

1. Open Xcode once and allow it to install required components.
2. Accept the Xcode license if prompted.
3. Add the developer's Apple ID in Xcode settings.
4. Select a development team for signing.

A free Apple Personal Team is sufficient for local testing on a small number of registered devices, but its development profiles expire quickly. A paid Apple Developer account is preferable for TestFlight or wider distribution.

### iPhone preparation

Use a physical ARKit-compatible iPhone.

1. Update iOS if practical.
2. Connect the iPhone to the Mac.
3. Trust the Mac when prompted.
4. Enable Developer Mode in iPhone privacy/security settings.
5. Confirm the device appears in Xcode's Devices and Simulators window.

The iOS Simulator is not the primary AR test target. Use a physical iPhone.

## 6. Google Cloud Project Preparation

One team member should act as the Google Cloud project owner and perform the initial project setup.

Before starting, confirm:

- A Google Cloud project has been created.
- Billing is enabled for the project.
- Every developer's Google account has been added to the project.
- The chosen project ID is shared with the team.
- The deployment region is agreed upon. For a team in India, use `asia-south1` unless another region is required.

Use these placeholders throughout this guide:

```text
PROJECT_ID=your-google-cloud-project-id
REGION=asia-south1
SERVICE_NAME=codexwars-backend
```

### Recommended developer permissions

Use least-privilege access where possible. Developers who deploy or debug the backend normally need:

- Cloud Run Developer: `roles/run.developer`
- Service Account User: `roles/iam.serviceAccountUser`
- Cloud Build Builds Editor: `roles/cloudbuild.builds.editor`
- Artifact Registry Writer: `roles/artifactregistry.writer`
- Logs Viewer: `roles/logging.viewer`

Only the project lead should need billing administration, project ownership, IAM administration, or unrestricted API-key management.

For a short hackathon, the project owner can simplify permissions if necessary, but should remove excessive access after the event.

## 7. Install and Configure Google Cloud CLI

Use the official [Google Cloud CLI installation guide](https://docs.cloud.google.com/sdk/docs/install-sdk).

### Windows installation

Use the official Windows installer. The installer can include a compatible Python runtime and add `gcloud` to the terminal environment.

After installation, open a new PowerShell window and run:

```powershell
gcloud init
gcloud auth login
gcloud auth application-default login
```

### macOS installation

Use the official installation package, or install the Homebrew cask:

```bash
brew install --cask google-cloud-sdk
```

Open a new terminal and run:

```bash
gcloud init
gcloud auth login
gcloud auth application-default login
```

### Configure the shared project

Every developer with project access should run:

```bash
gcloud config set project PROJECT_ID
gcloud config set run/region asia-south1
```

Replace `PROJECT_ID` with the real project ID.

The project owner should enable the required APIs once:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  arcore.googleapis.com
```

Verify access:

```bash
gcloud auth list
gcloud config list
gcloud projects describe PROJECT_ID
gcloud services list --enabled
gcloud run services list --region asia-south1
```

### Why two login commands are used

- `gcloud auth login` authenticates Google Cloud CLI commands.
- `gcloud auth application-default login` creates local Application Default Credentials used by local development tools and the Cloud Run MCP server.

Do not share the locally stored credentials or copy them into the repository.

## 8. Configure Google Cloud MCP for Backend Work

For CodexWars, use the official [Cloud Run MCP server](https://github.com/GoogleCloudPlatform/cloud-run-mcp). It can deploy a local folder, list Cloud Run services, inspect a service, and retrieve service logs.

The MCP server is launched through `npx`, so no global npm installation is required.

Add the following server to the MCP configuration of the team's coding agent or IDE:

```json
{
  "mcpServers": {
    "cloud-run": {
      "command": "npx",
      "args": ["-y", "@google-cloud/cloud-run-mcp"],
      "env": {
        "GOOGLE_CLOUD_PROJECT": "PROJECT_ID",
        "GOOGLE_CLOUD_REGION": "asia-south1",
        "DEFAULT_SERVICE_NAME": "codexwars-backend"
      }
    }
  }
}
```

Replace `PROJECT_ID` before saving the configuration. Restart the IDE or MCP client after changing its MCP configuration.

The MCP server uses the current developer's Application Default Credentials. Before starting the MCP client, verify them with:

```bash
gcloud auth application-default print-access-token
```

The command should return an access token. Never paste that token into source code, chat messages, screenshots, or committed files.

Useful Cloud Run MCP capabilities for the hackathon:

- Deploy the backend source folder to Cloud Run.
- List deployed services.
- Retrieve the backend URL and service state.
- Read recent application logs.
- Diagnose a failed deployment.

Use the MCP server for developer operations. Do not deploy the MCP server itself as an unauthenticated public service.

Google Cloud MCP documentation is available at [Google Cloud MCP servers](https://docs.cloud.google.com/mcp).

## 9. Backend Requirements for Cloud Run

The Colyseus backend must:

- Bind to `0.0.0.0`, not only `localhost`.
- Listen on `process.env.PORT`, with `8080` as a local fallback.
- Provide an HTTP health endpoint such as `GET /health`.
- Accept secure WebSocket connections through the deployed Cloud Run URL.
- Keep the server authoritative for player health, attacks, cooldowns, and match completion.
- Avoid relying on in-memory state surviving a container restart beyond the current demonstration.

Example port logic:

```ts
const port = Number(process.env.PORT ?? 8080);
server.listen(port, "0.0.0.0");
```

Cloud Run returns an HTTPS URL. Convert it to a secure WebSocket URL for the game client:

```text
https://codexwars-backend-xxxxx.a.run.app
                         ↓
wss://codexwars-backend-xxxxx.a.run.app
```

### Deploy from the command line

From the repository root, assuming the backend is in `server/`:

```bash
gcloud run deploy codexwars-backend \
  --source ./server \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600
```

`--allow-unauthenticated` makes the game backend reachable by participants' phones. It does **not** mean that the Google Cloud project, MCP server, or developer credentials are public.

For a smoother live demo, the project owner may temporarily configure one minimum instance to reduce cold starts. This can incur cost:

```bash
gcloud run services update codexwars-backend \
  --region asia-south1 \
  --min 1
```

Return it to zero after the demonstration:

```bash
gcloud run services update codexwars-backend \
  --region asia-south1 \
  --min 0
```

## 10. Backend Deployment and Test Commands

Retrieve the deployed URL:

```bash
BACKEND_URL=$(gcloud run services describe codexwars-backend \
  --region asia-south1 \
  --format='value(status.url)')

echo "$BACKEND_URL"
```

On Windows PowerShell:

```powershell
$BACKEND_URL = gcloud run services describe codexwars-backend `
  --region asia-south1 `
  --format="value(status.url)"

$BACKEND_URL
```

Test the health endpoint:

```bash
curl "$BACKEND_URL/health"
```

Read recent logs:

```bash
gcloud run services logs read codexwars-backend \
  --region asia-south1 \
  --limit 100
```

Inspect the service:

```bash
gcloud run services describe codexwars-backend \
  --region asia-south1
```

For a quick WebSocket test, use `wscat` through `npx` if the backend exposes a directly testable WebSocket route:

```bash
npx wscat -c "wss://YOUR_CLOUD_RUN_HOST/YOUR_WEBSOCKET_PATH"
```

## 11. Repository Dependencies

These dependencies belong in the repository and should not be globally installed.

### Mobile client

```bash
npx expo install expo expo-dev-client react-native
npm install @reactvision/react-viro @colyseus/sdk zustand
```

### Backend

```bash
npm install @colyseus/core @colyseus/schema @colyseus/ws-transport
```

The exact commands may be represented as workspace-specific scripts once the repository structure is finalized. After the lockfile exists, team members should use `npm ci`.

## 12. Build and Run the Mobile App

ViroReact and AR features do not run inside Expo Go. Use an Expo native development build on a physical device.

Generate native projects when requested by the AR/mobile lead:

```bash
npx expo prebuild --clean
```

Only run `prebuild --clean` when native project regeneration is intentional, because it rewrites generated native folders.

Build Android:

```bash
npx expo run:android
```

Build iOS on the Mac:

```bash
npx expo run:ios --device
```

Start Metro for a development build:

```bash
npx expo start --dev-client
```

## 13. Local Networking Rules

For local testing:

- Put all phones and laptops on the same Wi-Fi network.
- Avoid guest Wi-Fi that blocks device-to-device traffic.
- Allow Node.js and Metro through the Windows firewall when prompted.
- Confirm a phone can reach the laptop's local IP and backend port.
- Use the deployed Cloud Run backend if the venue network blocks local connections.
- Do not depend on inbound internet tunnels unless they have been tested before the event.

For the live demonstration, using Cloud Run for the realtime backend is usually more predictable than exposing a developer laptop on venue Wi-Fi.

## 14. Secrets and Security Rules

- Never commit Application Default Credentials.
- Never commit a service-account JSON key.
- Prefer user ADC locally and a Cloud Run service identity in production.
- Never commit an unrestricted Google API key.
- Restrict the ARCore API key to the required API and application identifiers.
- Keep `.env` in `.gitignore` and commit only `.env.example`.
- Do not paste access tokens into issue trackers, chat, or screenshots.
- Do not make the Cloud Run MCP server public.
- The public game backend must validate room codes, player IDs, cooldowns, and damage on the server.

## 15. Day-Before Verification Checklist

Every developer should complete the applicable items before the hackathon begins.

### Everyone

- [ ] Repository clone succeeds.
- [ ] `node --version` reports Node 22.
- [ ] `npm ci` succeeds.
- [ ] `npm run lint` succeeds, if configured.
- [ ] `npm run typecheck` succeeds, if configured.
- [ ] `gcloud --version` succeeds.
- [ ] `gcloud auth list` shows the correct account.
- [ ] `gcloud config get-value project` shows the CodexWars project.
- [ ] Cloud Run services can be listed.
- [ ] The developer knows which code area they own.

### Android developers

- [ ] `java -version` reports JDK 17.
- [ ] `adb devices` recognizes the physical phone.
- [ ] Google Play Services for AR is installed and updated.
- [ ] The development build installs and opens.
- [ ] Camera permission works.
- [ ] A basic ViroReact AR scene renders.

### iOS developer

- [ ] Xcode opens without pending component installation.
- [ ] The Apple development team is selected.
- [ ] The iPhone trusts the Mac and has Developer Mode enabled.
- [ ] CocoaPods installation succeeds.
- [ ] The development build installs and opens on the physical iPhone.
- [ ] Camera permission works.
- [ ] A basic ViroReact AR scene renders.

### Backend/cloud developer

- [ ] `gcloud auth application-default print-access-token` succeeds.
- [ ] Cloud Run MCP starts without an authentication error.
- [ ] A test backend deploy succeeds.
- [ ] The `/health` endpoint returns success.
- [ ] A phone can connect to the `wss://` backend endpoint.
- [ ] Cloud Run logs can be retrieved through CLI or MCP.
- [ ] The backend has been tested with at least two simultaneous phones.

## 16. Minimum Hackathon-Day Success Test

Before building gameplay features, prove this vertical slice:

1. The organizer creates a four-digit room.
2. Two physical phones join the same Colyseus room through Cloud Run.
3. Both phones receive synchronized player state over WebSockets.
4. One phone sends a test attack event.
5. The backend validates it and updates the other player's health.
6. Both clients display the same health values.
7. The backend logs are visible through Google Cloud CLI or Cloud Run MCP.
8. One Android phone renders a basic AR scene.

Once this works, the team can safely add Cloud Anchors, player targeting, effects, quiz rewards, and the full 12-player flow.

## 17. Official References

- [Google Cloud CLI installation](https://docs.cloud.google.com/sdk/docs/install-sdk)
- [Google Cloud MCP servers](https://docs.cloud.google.com/mcp)
- [Cloud Run MCP server](https://github.com/GoogleCloudPlatform/cloud-run-mcp)
- [Deploy services from source to Cloud Run](https://docs.cloud.google.com/run/docs/deploying-source-code)
- [Using WebSockets on Cloud Run](https://docs.cloud.google.com/run/docs/triggering/websockets)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [ViroReact documentation](https://viro-community.readme.io/docs/overview)
- [Android Studio](https://developer.android.com/studio)
- [ARCore supported devices](https://developers.google.com/ar/devices)
