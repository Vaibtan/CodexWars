import { defineRoom, defineServer } from "@colyseus/core";
import { registerOperationalRoutes, type OperationalApplication } from "./operational.js";
import { WarRoom } from "./rooms/war-room.js";

export function createAppConfig() {
  let roomsRegistered = false;
  return defineServer({
    beforeListen: () => {
      roomsRegistered = true;
    },
    express: (app: OperationalApplication) => registerOperationalRoutes(app, () => roomsRegistered),
    rooms: {
      war: defineRoom(WarRoom)
    }
  });
}

const appConfig = createAppConfig();

export default appConfig;
