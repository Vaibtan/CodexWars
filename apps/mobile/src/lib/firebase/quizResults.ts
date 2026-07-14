import { doc, getDoc } from "firebase/firestore";
import type { QuizResult } from "@codexwars/shared";
import { ensureAnonymousFirebaseUser, getFirebaseServices } from "./client";

export type { QuizResult } from "@codexwars/shared";

export async function readMyQuizResult(sessionId: string): Promise<QuizResult | null> {
  const firebase = getFirebaseServices();
  const user = await ensureAnonymousFirebaseUser();

  if (!firebase || !user) {
    return null;
  }

  const snapshot = await getDoc(
    doc(firebase.firestore, "quizSessions", sessionId, "results", user.uid),
  );

  return snapshot.exists() ? (snapshot.data() as QuizResult) : null;
}
