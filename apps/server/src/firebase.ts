import { applicationDefault, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function configuredProjectId(): string | undefined {
  return process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT;
}

export function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = configuredProjectId();

  return initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {})
  });
}

export function getFirestoreDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
