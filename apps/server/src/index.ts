import { createServer } from "node:http";

// Persistence remains optional: the first local server runs on a LAN without
// Firebase. Firebase helpers stay available for later room persistence work.
export { getFirebaseApp, getFirestoreDb } from "./firebase.js";

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
