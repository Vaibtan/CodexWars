import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";
import type {
  QuizAnswer,
  QuizQuestion,
  QuizResult,
  QuizSession,
  QuizTemplate,
} from "./types.js";

type StoredSubmission = {
  answers?: QuizAnswer[];
};

export class DuplicateQuizAnswerError extends Error {
  constructor(questionId: string) {
    super(`An answer was already recorded for question ${questionId}.`);
    this.name = "DuplicateQuizAnswerError";
  }
}

export class FirestoreQuizRepository {
  constructor(private readonly firestore: Firestore) {}

  async seedTemplate(template: QuizTemplate): Promise<void> {
    const templateReference = this.firestore.collection("quizTemplates").doc(template.id);
    const batch = this.firestore.batch();

    batch.set(
      templateReference,
      {
        version: template.version,
        title: template.title,
        questionCount: template.questions.length,
        status: "published",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    for (const question of template.questions) {
      batch.set(templateReference.collection("questions").doc(question.id), question);
    }

    await batch.commit();
  }

  async loadTemplate(templateId: string): Promise<QuizTemplate | null> {
    const templateReference = this.firestore.collection("quizTemplates").doc(templateId);
    const [templateSnapshot, questionSnapshot] = await Promise.all([
      templateReference.get(),
      templateReference.collection("questions").orderBy("order").get(),
    ]);

    if (!templateSnapshot.exists) {
      return null;
    }

    const metadata = templateSnapshot.data() as DocumentData;
    const questions = questionSnapshot.docs.map((document) => document.data() as QuizQuestion);

    return {
      id: templateSnapshot.id,
      version: metadata.version as number,
      title: metadata.title as string,
      questions,
    };
  }

  async createSession(session: QuizSession): Promise<void> {
    await this.firestore.collection("quizSessions").doc(session.id).create({
      organizerUid: session.organizerUid,
      templateId: session.templateId,
      templateVersion: session.templateVersion,
      status: "active",
      startedAt: FieldValue.serverTimestamp(),
    });
  }

  async recordAnswer(sessionId: string, uid: string, answer: QuizAnswer): Promise<void> {
    const submissionReference = this.firestore
      .collection("quizSessions")
      .doc(sessionId)
      .collection("submissions")
      .doc(uid);

    await this.firestore.runTransaction(async (transaction) => {
      const submission = (await transaction.get(submissionReference)).data() as StoredSubmission | undefined;
      const answers = submission?.answers ?? [];

      if (answers.some((recorded) => recorded.questionId === answer.questionId)) {
        throw new DuplicateQuizAnswerError(answer.questionId);
      }

      transaction.set(
        submissionReference,
        {
          answers: [...answers, { ...answer, submittedAt: Timestamp.now() }],
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
  }

  async recordResult(sessionId: string, uid: string, result: QuizResult): Promise<void> {
    const sessionReference = this.firestore.collection("quizSessions").doc(sessionId);
    const batch = this.firestore.batch();

    batch.set(
      sessionReference.collection("submissions").doc(uid),
      {
        score: result.score,
        shieldReward: result.shieldReward,
        scoredAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    batch.set(sessionReference.collection("results").doc(uid), {
      ...result,
      completedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
  }

  async completeSession(sessionId: string): Promise<void> {
    await this.firestore.collection("quizSessions").doc(sessionId).update({
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
    });
  }
}
