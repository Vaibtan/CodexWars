import { defineRoom, defineServer } from "@colyseus/core";
import { registerOperationalRoutes, type OperationalApplication } from "./operational.js";
import { WarRoom } from "./rooms/war-room.js";
import { serverConfig } from "./config.js";
import { registerMatchmakingAdmission } from "./matchmaking-admission.js";
import { productionAdmission } from "./runtime-services.js";

export function createAppConfig() {
  let roomsRegistered = false;
  return defineServer({
    beforeListen: () => {
      roomsRegistered = true;
    },
    express: (app: OperationalApplication) => {
      registerMatchmakingAdmission(app, productionAdmission, serverConfig.trustProxy);
      registerOperationalRoutes(app, () => roomsRegistered, serverConfig.generation.capability);
    },
    rooms: {
      war: defineRoom(WarRoom)
    }
  });
}

const appConfig = createAppConfig();

export default appConfig;
