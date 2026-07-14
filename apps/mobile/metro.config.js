const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, "../..");

config.resolver.assetExts.push("glb", "gltf");
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]));

// The private shared workspace publishes TypeScript source with NodeNext-style
// `.js` specifiers. Node/tsx and Vitest map those specifiers back to `.ts`, but
// Metro needs the extension removed so its sourceExts resolution can do so.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSharedWorkspaceImport = context.originModulePath.includes(
    `${path.sep}packages${path.sep}shared${path.sep}`,
  );
  const resolvedModuleName =
    isSharedWorkspaceImport && moduleName.startsWith(".") && moduleName.endsWith(".js")
      ? moduleName.slice(0, -3)
      : moduleName;

  return context.resolveRequest(context, resolvedModuleName, platform);
};

module.exports = config;
