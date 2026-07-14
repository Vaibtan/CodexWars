import { createServer } from "node:http";

// Firestore durably stores quiz templates, submissions, and final results.
// Colyseus remains the authority for the room clock, scoring, and combat.
export {
  getFirebaseApp,
  getFirebaseAuth,
  getFirestoreDb,
  verifyFirebaseIdToken,
} from "./firebase.js";
export { FirestoreQuizRepository } from "./quiz/firestoreQuizRepository.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "codexwars-server" }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, () => {
  console.log(`CodexWars server listening on http://localhost:${port}`);
});
