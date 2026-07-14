import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth, type User } from "firebase/auth";
import {
  connectDatabaseEmulator,
  getDatabase,
  type Database,
} from "firebase/database";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  database: Database;
  firestore: Firestore;
};

const config: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
};

let services: FirebaseServices | null | undefined;
let emulatorsConnected = false;

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId && config.databaseURL);
}

export function getFirebaseServices(): FirebaseServices | null {
  if (services !== undefined) {
    return services;
  }

  if (!isFirebaseConfigured()) {
    services = null;
    return services;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const database = getDatabase(app, config.databaseURL);
  const firestore = getFirestore(app);
  const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;

  if (__DEV__ && emulatorHost && !emulatorsConnected) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectDatabaseEmulator(database, emulatorHost, 9000);
    connectFirestoreEmulator(firestore, emulatorHost, 8080);
    emulatorsConnected = true;
  }

  services = { app, auth, database, firestore };
  return services;
}

export async function ensureAnonymousFirebaseUser(): Promise<User | null> {
  const firebase = getFirebaseServices();

  if (!firebase) {
    return null;
  }

  return firebase.auth.currentUser ?? (await signInAnonymously(firebase.auth)).user;
}

export async function getFirebaseIdToken(): Promise<string | null> {
  const user = await ensureAnonymousFirebaseUser();
  return user ? user.getIdToken() : null;
}
