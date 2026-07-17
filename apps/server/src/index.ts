import appConfig from "./app.config.js";
import { serverConfig } from "./config.js";
import { beginWarRoomShutdown } from "./rooms/war-room.js";

async function shutdown(): Promise<void> {
  beginWarRoomShutdown();
  await appConfig.gracefullyShutdown(false);
}

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());

void appConfig.listen(serverConfig.port, "0.0.0.0", undefined, () => {
  console.log(`CodexWars server listening on http://localhost:${serverConfig.port}`);
});
