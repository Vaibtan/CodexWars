const fs = require("node:fs");
const path = require("node:path");
const { withFinalizedMod } = require("@expo/config-plugins");

const LOCAL_VIRO_PATH = "../node_modules/@reactvision/react-viro";
const WORKSPACE_VIRO_PATH = "../../../node_modules/@reactvision/react-viro";

function useWorkspaceViroPath(contents) {
  return contents.replaceAll(LOCAL_VIRO_PATH, WORKSPACE_VIRO_PATH);
}

module.exports = function withViroMonorepoPaths(config) {
  config = withFinalizedMod(config, [
    "ios",
    async (iosConfig) => {
      const podfilePath = path.join(iosConfig.modRequest.platformProjectRoot, "Podfile");
      const podfile = fs.readFileSync(podfilePath, "utf8");
      fs.writeFileSync(podfilePath, useWorkspaceViroPath(podfile));
      return iosConfig;
    },
  ]);

  return withFinalizedMod(config, [
    "android",
    async (androidConfig) => {
      const settingsPath = path.join(
        androidConfig.modRequest.platformProjectRoot,
        "settings.gradle",
      );
      const settings = fs.readFileSync(settingsPath, "utf8");
      fs.writeFileSync(settingsPath, useWorkspaceViroPath(settings));
      return androidConfig;
    },
  ]);
};
