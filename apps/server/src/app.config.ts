import { defineRoom, defineServer } from "@colyseus/core";
import { registerOperationalRoutes, type OperationalApplication } from "./operational.js";
import { createWarRoomClass, type WarRoomDependencies } from "./rooms/war-room.js";
import { serverConfig } from "./config.js";
import { registerMatchmakingAdmission } from "./matchmaking-admission.js";
import { productionAdmission, productionWarRoomDependencies } from "./runtime-services.js";

export function createAppConfig(overrides: Partial<WarRoomDependencies> = {}) {
  let roomsRegistered = false;
  const warRoom = createWarRoomClass({ ...productionWarRoomDependencies, ...overrides });
  return defineServer({
    beforeListen: () => {
      roomsRegistered = true;
    },
    express: (app: OperationalApplication) => {
      registerMatchmakingAdmission(app, productionAdmission, serverConfig.trustProxy);
      registerOperationalRoutes(app, () => roomsRegistered, serverConfig.generation.capability);
    },
    rooms: {
      war: defineRoom(warRoom)
    }
  });
}

const appConfig = createAppConfig();

export default appConfig;
