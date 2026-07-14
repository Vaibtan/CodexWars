import { createCodexWarsHttpServer } from "./httpServer.js";

// Firestore durably stores quiz templates, submissions, and final results.
// Colyseus remains the authority for the room clock, scoring, and combat.
export {
  getFirebaseApp,
  getFirebaseAuth,
  getFirestoreDb,
  verifyFirebaseIdToken,
} from "./firebase.js";
export { FirestoreQuizRepository } from "./quiz/firestoreQuizRepository.js";
export { createCodexWarsHttpServer } from "./httpServer.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);

const server = createCodexWarsHttpServer();

server.listen(port, () => {
  console.log(`CodexWars server listening on http://localhost:${port}`);
});
