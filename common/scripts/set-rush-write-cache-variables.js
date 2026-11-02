/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const buildCache = require("../config/rush/build-cache.json");

function getCacheVariables(env, nodeVersion = process.versions.node) {
  // Native overrides are untracked artifacts, not safe inputs to the shared cache.
  const nativeBuild = env.ITWIN_NATIVE_PR_VALIDATION === "true" || !!env.IMODELJS_NATIVE_OVERRIDE;
  const enabled = env.RUSH_BUILD_CACHE_ENABLED === "1" && !nativeBuild;
  const trustedBranch = env.BUILD_SOURCEBRANCH === "refs/heads/master"
    || /^refs\/heads\/release\/[^/]+$/.test(env.BUILD_SOURCEBRANCH || "");
  // Defense in depth only: the writer SAS must also have server-side resource checks.
  const writeAllowed = enabled && env.ITWIN_RUSH_CACHE_WRITE_ENABLED === "true"
    && env.BUILD_REPOSITORY_NAME === "iTwin/itwinjs-core"
    && ["Linux", "Windows_NT", "Darwin"].includes(env.AGENT_OS)
    && ["IndividualCI", "BatchedCI"].includes(env.BUILD_REASON)
    && env.SYSTEM_PULLREQUEST_ISFORK?.toLowerCase() !== "true" && trustedBranch;

  return {
    // Do not enable caching job-wide for later webpack/test/docs operations.
    RushBuildCacheEnabled: enabled ? "1" : "0",
    RUSH_BUILD_CACHE_WRITE_ALLOWED: writeAllowed ? "1" : "0",
    // Rush hashes source and dependency inputs, but not the Node runtime.
    RUSH_BUILD_CACHE_OVERRIDE_JSON: JSON.stringify({
      ...buildCache,
      cacheHashSalt: `${buildCache.cacheHashSalt}-node-${nodeVersion}`,
    }),
  };
}

if (require.main === module) {
  for (const [name, value] of Object.entries(getCacheVariables(process.env))) {
    console.log(`##vso[task.setvariable variable=${name};]${value}`);
  }
}

module.exports = { getCacheVariables };