import { afterEach, describe, expect, it } from "vitest";
import { deleteApp, getApps } from "firebase-admin/app";
import { getFirebaseApp, getFirebaseAuth, getFirestoreDb } from "../src/firebase.js";

const originalProjectId = process.env.FIREBASE_PROJECT_ID;
const originalGoogleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;

afterEach(async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));

  if (originalProjectId === undefined) {
    delete process.env.FIREBASE_PROJECT_ID;
  } else {
    process.env.FIREBASE_PROJECT_ID = originalProjectId;
  }

  if (originalGoogleCloudProject === undefined) {
    delete process.env.GOOGLE_CLOUD_PROJECT;
  } else {
    process.env.GOOGLE_CLOUD_PROJECT = originalGoogleCloudProject;
  }
});

describe("Firebase Admin initialization", () => {
  it("uses the configured project and reuses the default app", () => {
    process.env.FIREBASE_PROJECT_ID = "codexwars-test";
    delete process.env.GOOGLE_CLOUD_PROJECT;

    const firstApp = getFirebaseApp();
    const secondApp = getFirebaseApp();
    const firstAuth = getFirebaseAuth();
    const secondAuth = getFirebaseAuth();
    const firstFirestore = getFirestoreDb();
    const secondFirestore = getFirestoreDb();

    expect(firstApp.options.projectId).toBe("codexwars-test");
    expect(secondApp).toBe(firstApp);
    expect(secondAuth).toBe(firstAuth);
    expect(secondFirestore).toBe(firstFirestore);
  });
});
