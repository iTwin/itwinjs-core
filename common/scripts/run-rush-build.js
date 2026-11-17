/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Usage: node common/scripts/run-rush-build.js <off|read|write> [Rush build arguments]
const childProcess = require("node:child_process");
const path = require("node:path");
const buildCache = require("../config/rush/build-cache.json");

function getBuildCacheConfig(mode, env, nodeVersion = process.versions.node) {
  if (!["off", "read", "write"].includes(mode))
    throw new Error("Cache mode must be off, read, or write.");

  // Native test artifacts can replace the published package without changing its version.
  const nativeBuild = env.ITWIN_NATIVE_PR_VALIDATION?.toLowerCase() === "true" || !!env.IMODELJS_NATIVE_OVERRIDE;
  const enabled = mode !== "off" && !nativeBuild;
  return {
    ...buildCache,
    buildCacheEnabled: enabled,
    // Rush hashes source and dependency inputs, but not the Node runtime.
    cacheHashSalt: `${buildCache.cacheHashSalt}-node-${nodeVersion}`,
    azureBlobStorageConfiguration: {
      ...buildCache.azureBlobStorageConfiguration,
      isCacheWriteAllowed: enabled && mode === "write",
    },
  };
}

function runRushBuild(mode, args, env = process.env) {
  const config = getBuildCacheConfig(mode, env);
  const buildEnv = { ...env, RUSH_BUILD_CACHE_OVERRIDE_JSON: JSON.stringify(config) };
  // Inherited Rush switches must not override the selected mode.
  delete buildEnv.RUSH_BUILD_CACHE_ENABLED;
  delete buildEnv.RUSH_BUILD_CACHE_WRITE_ALLOWED;
  delete buildEnv.RUSH_BUILD_CACHE_OVERRIDE_JSON_FILE_PATH;
  if (!config.buildCacheEnabled)
    delete buildEnv.RUSH_BUILD_CACHE_CREDENTIAL;

  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, "install-run-rush.js"), "build", ...args], {
    env: buildEnv,
    stdio: "inherit",
  });
  if (result.error) {
    console.error("Unable to start Rush build.");
    return 1;
  }
  return result.status ?? 1;
}

if (require.main === module) {
  try {
    const [mode, ...args] = process.argv.slice(2);
    process.exitCode = runRushBuild(mode, args);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { getBuildCacheConfig, runRushBuild };
