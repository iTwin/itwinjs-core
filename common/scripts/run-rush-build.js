/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Usage: node common/scripts/run-rush-build.js <off|read|write> [Rush build arguments]
const childProcess = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const buildCache = require("../config/rush/build-cache.json");
const nativeCacheKeyEnv = "ITWIN_NATIVE_CACHE_KEY";

function isNativeBuild(env) {
  return env.ITWIN_NATIVE_PR_VALIDATION?.toLowerCase() === "true" || !!env.IMODELJS_NATIVE_OVERRIDE;
}

function supportsNativeCacheKey() {
  // Older checkouts must not restore backend output compiled against other native declarations.
  try {
    const backend = JSON.parse(fs.readFileSync(path.join(__dirname, "../../core/backend/config/rush-project.json"), "utf8"));
    return backend.operationSettings?.some((operation) => operation.operationName === "build" && operation.dependsOnEnvVars?.includes(nativeCacheKeyEnv)) ?? false;
  } catch {
    return false;
  }
}

function getBuildCacheConfig(mode, env, nodeVersion = process.versions.node) {
  if (!["off", "read", "write"].includes(mode))
    throw new Error("Cache mode must be off, read, or write.");

  // Native test artifacts can replace the published package without changing its version.
  const nativeBuild = isNativeBuild(env);
  // A write credential cannot be downgraded after runtime-only native detection.
  // Explicit native readers arrive in read mode with a reader credential.
  const enabled = mode !== "off" && (!nativeBuild || (mode === "read" && supportsNativeCacheKey()));
  return {
    ...buildCache,
    buildCacheEnabled: enabled,
    // Rush hashes source and dependency inputs, but not the Node runtime.
    cacheHashSalt: `${buildCache.cacheHashSalt}-node-${nodeVersion}`,
    azureBlobStorageConfiguration: {
      ...buildCache.azureBlobStorageConfiguration,
      isCacheWriteAllowed: enabled && mode === "write" && !nativeBuild,
    },
  };
}

function runRushBuild(mode, args, env = process.env) {
  const config = getBuildCacheConfig(mode, env);
  const nativeBuild = isNativeBuild(env);
  const buildEnv = {
    ...env,
    RUSH_BUILD_CACHE_OVERRIDE_JSON: JSON.stringify(config),
    // Also prevent newly built output from entering Rush's local cache in read-only mode.
    RUSH_BUILD_CACHE_WRITE_ALLOWED: config.azureBlobStorageConfiguration.isCacheWriteAllowed ? "1" : "0",
  };
  // Inherited Rush switches must not override the selected mode.
  delete buildEnv.RUSH_BUILD_CACHE_ENABLED;
  delete buildEnv.RUSH_BUILD_CACHE_OVERRIDE_JSON_FILE_PATH;
  delete buildEnv[nativeCacheKeyEnv];
  if (config.buildCacheEnabled && nativeBuild) {
    // Only backend declares this input; Rush propagates it to backend consumers, not unrelated projects.
    buildEnv[nativeCacheKeyEnv] = `native-${env.BUILD_BUILDID || randomUUID()}`;
  }
  if (!config.buildCacheEnabled)
    delete buildEnv.RUSH_BUILD_CACHE_CREDENTIAL;

  // Disabling archive caching does not invalidate Rush's legacy incremental records.
  const command = nativeBuild && !config.buildCacheEnabled ? "rebuild" : "build";
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, "install-run-rush.js"), command, ...args], {
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
