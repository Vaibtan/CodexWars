import { getFirestoreDb } from "../firebase.js";
import { FirestoreQuizRepository } from "./firestoreQuizRepository.js";
import { PROGRAMMING_FUNDAMENTALS_V1 } from "./programmingFundamentalsV1.js";

const repository = new FirestoreQuizRepository(getFirestoreDb());

await repository.seedTemplate(PROGRAMMING_FUNDAMENTALS_V1);
console.log(`Seeded ${PROGRAMMING_FUNDAMENTALS_V1.id}.`);
