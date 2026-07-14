# Firebase setup for the quiz module

**Decision:** Firestore is the durable store for quiz templates, answer keys, submissions, and completed results. Colyseus remains the authoritative live-game server: it owns the quiz clock, accepts answers, scores them, and decides shield rewards. The mobile app must never receive an Admin SDK credential or a document containing an answer key.

This design keeps live multiplayer independent of Firestore latency and prevents a client from discovering or changing correct answers. Firebase Admin clients bypass Firestore Security Rules and are instead authorized with IAM, so the server must be treated as a trusted boundary. [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

## 1. Create the Firebase resources

1. In the [Firebase console](https://console.firebase.google.com/), create a Firebase project for the target environment (use separate development and production projects).
2. In **Firestore Database**, create the default database in the region selected for the project. Do not leave production in test mode; deploy version-controlled rules before real devices use it. [Firestore quickstart](https://firebase.google.com/docs/firestore/quickstart)
3. In **Authentication → Sign-in method**, enable **Anonymous**. The mobile app signs in once and uses the resulting Firebase UID as its participant identity for the active app session. [Anonymous Authentication](https://firebase.google.com/docs/auth/web/anonymous-auth)
4. In **Project settings → General**, register a **Web** app named `codexwars-expo`. Copy its Firebase configuration object. This is the correct configuration artifact for the Expo Firebase JavaScript SDK.

### Which JSON/config files are required?

| Artifact | Needed here? | How to obtain it | Handling |
| --- | --- | --- | --- |
| Firebase Web configuration object | Yes | Register the Firebase Web app, or run `firebase apps:sdkconfig WEB FIREBASE_APP_ID` | Client-visible configuration; provide through `EXPO_PUBLIC_*` variables. |
| `GoogleService-Info.plist` | No | Firebase console Apple app registration | Needed only if adopting a native Apple Firebase SDK, not the Expo Firebase JavaScript SDK path. |
| `google-services.json` | No | Firebase console Android app registration | Needed only if adopting a native Android Firebase SDK, not the Expo Firebase JavaScript SDK path. |
| Service-account private-key JSON | Local server only, if not using local user ADC | Firebase console → **Project settings → Service accounts → Generate new private key** | Secret. Store outside this repository and never copy to the phone or an Expo environment variable. |

Firebase identifies a web client through the configuration object; Firebase API keys are public by design and do not authorize Firestore access. Security Rules and App Check are the access controls. [Firebase API-key guidance](https://firebase.google.com/docs/projects/api-keys)

## 2. Server: Firebase Admin SDK

`apps/server` already depends on `firebase-admin` and has `src/firebase.ts`, which initializes one Admin app using Application Default Credentials (ADC). Keep that module server-only: no file under `apps/mobile` may import it.

### Local development credentials

**Recommended for an individual developer:** authenticate ADC with the Google Cloud CLI, then set the project ID. This avoids creating a long-lived downloaded key.

```bash
gcloud auth application-default login
export FIREBASE_PROJECT_ID="codexwars-dev"
npm run server
```

If the server also calls Firebase Authentication with end-user ADC, follow Firebase's documented custom OAuth client-ID caveat, or use a service account. [Admin SDK setup: local ADC](https://firebase.google.com/docs/admin/setup)

**Alternative for a local/on-premises shared server:** generate the service-account JSON in the Firebase console, keep it outside the repository, and point ADC at it:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/codexwars/codexwars-dev-admin.json"
export FIREBASE_PROJECT_ID="codexwars-dev"
npm run server
```

Do not commit the downloaded JSON, paste it into `.env`, or place it in `apps/mobile`. Firebase recommends ADC in Google-managed production environments, where `initializeApp()` uses the workload's attached service account without a downloaded key. [Admin SDK setup](https://firebase.google.com/docs/admin/setup)

### Production credentials

Run the Colyseus server on a Google-managed workload (for example Cloud Run) with a dedicated service account that has only the Firestore and Authentication permissions it needs. Use `initializeApp()` / ADC, not a JSON key. The current `getFirebaseApp()` implementation already follows this model when the workload supplies ADC.

### Authenticate the game connection

At app launch, sign in anonymously. Pass the Firebase ID token to the Colyseus server during the authenticated room join/handshake. The server verifies it with `getAuth().verifyIdToken(token)` and binds the verified `uid` to the room player. Never accept a client-supplied UID as proof of identity. [Verify ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)

## 3. Expo / React Native Firebase JavaScript SDK

Use the modular Firebase JavaScript SDK, not Firebase Admin, on the phone. Firebase documents npm bundles as suitable for non-browser applications including React Native. [Firebase for web platforms](https://firebase.google.com/docs/web/learn-more)

Install the SDK from the repository root (the Expo installer selects a compatible package):

```bash
npx expo install firebase
```

Place the Web app configuration in the local `apps/mobile/.env` file (ignored by Git):

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=codexwars-dev.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=codexwars-dev
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=codexwars-dev.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

`EXPO_PUBLIC_*` values are included in the app bundle. That is acceptable for the Web Firebase configuration but categorically unsafe for a service-account JSON, private key, server URL containing credentials, or any other secret.

The mobile initialization boundary should be one module, such as `apps/mobile/src/lib/firebase/client.ts`:

```ts
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const hasFirebaseApp = getApps().length > 0;
const app = hasFirebaseApp
  ? getApp()
  : initializeApp({
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    });

export const auth = getAuth(app);

export { app };
export const firestore = getFirestore(app);
```

The project's installed Firebase version currently does not expose a usable React Native persistence helper from `firebase/auth`; do not add a persistence import by copying older examples. Keep this minimal `getAuth` setup until the exact Expo-compatible Firebase Auth persistence API is validated in the installed package and on both platforms. [Firebase Auth JS reference](https://firebase.google.com/docs/reference/js/auth)

Sign in before any protected read:

```ts
import { signInAnonymously } from "firebase/auth";
import { auth } from "./client";

export async function ensureAnonymousSession() {
  return auth.currentUser ?? (await signInAnonymously(auth)).user;
}
```

## 4. Firestore data boundary and schema

The trusted server reads full templates and writes submissions/results. It sends only public question data through Colyseus. The mobile Firestore SDK need not read quiz data in P0; if it is used, limit it to the authenticated player's final result and public catalogue metadata.

```text
quizTemplates/{templateId}
  version, title, status, questionCount, createdAt, updatedAt
quizTemplates/{templateId}/questions/{questionId}        # server-only
  prompt, options, correctOptionId, explanation, durationMs, difficulty

quizSessions/{sessionId}                                 # server-written
  templateId, templateVersion, organizerUid, status, startedAt, completedAt
quizSessions/{sessionId}/submissions/{uid}                # server-written
  answers: [{ questionId, optionId, submittedAt }], score, shieldReward
quizSessions/{sessionId}/results/{uid}                    # server-written; optional client read
  displayName, score, shieldReward, rank, completedAt
```

Use subcollections for question and per-player result data because those lists grow independently of a parent document; Firestore supports querying subcollections without expanding the parent document. [Choose a data structure](https://firebase.google.com/docs/firestore/manage-data/structure-data)

Use Admin `FieldValue.serverTimestamp()` for audit times. Firestore auto IDs do not imply creation order, so always store timestamps explicitly. [Add Firestore data](https://firebase.google.com/docs/firestore/manage-data/add-data)

## 5. Security Rules

Start from deny-by-default. This ruleset allows an anonymous/authenticated player to read only their own completed result; all template questions, submissions, and session writes remain server-only.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /quizSessions/{sessionId}/results/{uid} {
      allow get: if request.auth != null && request.auth.uid == uid;
      allow list, create, update, delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

If a later UI directly reads a public quiz catalogue, create a separate `quizCatalog/{templateId}` projection without answer keys and permit only authenticated `get`/`list` reads there. Do not loosen access to `quizTemplates/*/questions/*`; Firestore rules are evaluated on every mobile/web SDK request, while Admin SDK calls bypass them. [Rules conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)

## 6. Firebase CLI and Emulator Suite

Install and authenticate the CLI, then add version-controlled Firestore rules and the Auth/Firestore emulators:

```bash
npm install --global firebase-tools
firebase login
firebase use --add
firebase init firestore
firebase init emulators
firebase emulators:start --only auth,firestore
```

The configured emulator ports are Auth `9099`, Firestore `8080`, and Emulator UI `4001` (port `4000` is reserved for the local game server). The Emulator Suite requires Node.js and a JDK for Firestore; use the version-controlled `firebase.json` to track rules and ports. [Install and configure the Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure)

For a local server, point Admin SDK at the emulator before starting it:

```bash
export FIREBASE_PROJECT_ID="codexwars-dev"
export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
npm run server
```

For a phone, `127.0.0.1` is the phone itself, not the laptop. Supply the laptop LAN address only in a development-only app setting, then connect the client SDK before its first Firestore operation:

```ts
import { connectFirestoreEmulator } from "firebase/firestore";
import { firestore } from "./client";

connectFirestoreEmulator(firestore, "192.168.1.10", 8080);
```

Use the same local project ID in client, Admin process, and emulator. The emulator UI shows requests and Security Rules evaluation traces, which should be part of rules tests. [Connect to the Firestore emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore)

## 7. Implementation checklist

1. Create the development Firebase project, Firestore database, anonymous provider, Web app, and local `.env` values.
2. Add `firebase`, the mobile Firebase client boundary, anonymous sign-in, and ID-token room authentication.
3. Add `firestore.rules`, `firebase.json`, emulator scripts, and emulator-backed rule tests.
4. Run `npm run seed:quiz` with server ADC configured to seed `programming-fundamentals-v1`; the server repository loads the full template and persists submissions/results using Admin SDK transactions/batches.
5. Keep the Colyseus room as the sole clock/scoring source; write finalized submissions/results asynchronously and handle a Firestore write failure without changing the live game outcome.
6. Deploy rules with `firebase deploy --only firestore:rules`, validate on both Android and iOS, then set up the production Firebase project and workload identity.
