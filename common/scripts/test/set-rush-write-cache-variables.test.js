/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { getCacheVariables } = require("../set-rush-write-cache-variables.js");

const trusted = {
  AGENT_OS: "Linux",
  BUILD_REPOSITORY_NAME: "iTwin/itwinjs-core",
  BUILD_REASON: "IndividualCI",
  BUILD_SOURCEBRANCH: "refs/heads/master",
  RUSH_BUILD_CACHE_ENABLED: "1",
  ITWIN_RUSH_CACHE_WRITE_ENABLED: "true",
};

for (const os of ["Linux", "Windows_NT", "Darwin"]) {
  for (const reason of ["IndividualCI", "BatchedCI"]) {
    for (const branch of ["refs/heads/master", "refs/heads/release/5.15.x"]) {
      test(`allow ${os} ${reason} ${branch}`, () => {
        const result = getCacheVariables({ ...trusted, AGENT_OS: os, BUILD_REASON: reason, BUILD_SOURCEBRANCH: branch });
        assert.equal(result.RushBuildCacheEnabled, "1");
        assert.equal(result.RUSH_BUILD_CACHE_WRITE_ALLOWED, "1");
      });
    }
  }
}

for (const change of [
  { BUILD_REASON: "PullRequest" },
  { BUILD_REASON: "Manual" },
  { BUILD_REASON: "Schedule" },
  { BUILD_REASON: "BuildCompletion" },
  { BUILD_REASON: undefined },
  { BUILD_SOURCEBRANCH: "refs/pull/42/merge" },
  { BUILD_SOURCEBRANCH: "refs/heads/feature/cache" },
  { BUILD_SOURCEBRANCH: "refs/heads/master-unprotected" },
  { BUILD_SOURCEBRANCH: "refs/heads/releases/5.15.x" },
  { BUILD_SOURCEBRANCH: "refs/heads/release/" },
  { BUILD_SOURCEBRANCH: "refs/heads/release/5.15.x/feature" },
  { BUILD_SOURCEBRANCH: "refs/tags/release/5.15.x" },
  { BUILD_SOURCEBRANCH: undefined },
  { BUILD_REPOSITORY_NAME: "iTwin/imodel-native" },
  { BUILD_REPOSITORY_NAME: undefined },
  { SYSTEM_PULLREQUEST_ISFORK: "True" },
  { AGENT_OS: "unknown" },
  { AGENT_OS: undefined },
  { ITWIN_RUSH_CACHE_WRITE_ENABLED: "false" },
  { ITWIN_RUSH_CACHE_WRITE_ENABLED: undefined },
]) {
  test(`read-only for ${JSON.stringify(change)}`, () => {
    const result = getCacheVariables({ ...trusted, ...change });
    assert.equal(result.RushBuildCacheEnabled, "1");
    assert.equal(result.RUSH_BUILD_CACHE_WRITE_ALLOWED, "0");
  });
}

test("disable reads and writes for disabled caching or untracked native builds", () => {
  for (const change of [
    { RUSH_BUILD_CACHE_ENABLED: "0" },
    { RUSH_BUILD_CACHE_ENABLED: undefined },
    { ITWIN_NATIVE_PR_VALIDATION: "true" },
    { IMODELJS_NATIVE_OVERRIDE: "/tmp/native-under-test" },
  ]) {
    const result = getCacheVariables({ ...trusted, ...change });
    assert.equal(result.RushBuildCacheEnabled, "0");
    assert.equal(result.RUSH_BUILD_CACHE_WRITE_ALLOWED, "0");
  }
  assert.equal(getCacheVariables({}).RUSH_BUILD_CACHE_WRITE_ALLOWED, "0");
});

test("isolate the exact Node version and retain OS/architecture keys in a new container", () => {
  const config = (version) => JSON.parse(getCacheVariables(trusted, version).RUSH_BUILD_CACHE_OVERRIDE_JSON);
  const first = config("24.11.0");
  assert.notEqual(first.cacheHashSalt, config("24.11.1").cacheHashSalt);
  assert.notEqual(first.cacheHashSalt, config("22.11.0").cacheHashSalt);
  assert.equal(first.cacheEntryNamePattern, "[os]-[arch]-[hash]");
  assert.equal(first.azureBlobStorageConfiguration.storageContainerName, "itwincache-v2");
  assert.equal(first.buildCacheEnabled, false);
  assert.equal(first.azureBlobStorageConfiguration.isCacheWriteAllowed, false);
  assert.equal(config("24.11.0").cacheHashSalt, first.cacheHashSalt);
});

test("never cache builds that inject the job environment into browser bundles", () => {
  for (const folder of ["core/electron", "core/i18n", "full-stack-tests/core", "test-apps/display-test-app", "test-apps/display-performance-test-app"]) {
    const config = JSON.parse(readFileSync(path.join(__dirname, "../../..", folder, "config/rush-project.json"), "utf8"));
    assert.equal(config.operationSettings.find((operation) => operation.operationName === "build").disableBuildCacheForOperation, true);
  }
});

test("keep writer credential selection and opt-in behind the same CI/ref guard", () => {
  const pipeline = readFileSync(path.join(__dirname, "../../config/azure-pipelines/jobs/fast-ci.yaml"), "utf8");
  const groupGuard = pipeline.match(/\$\{\{ if (and\(in\(variables\['Build.Reason'\][^\n]+) \}\}:/)?.[1];
  const writerOptIn = pipeline.match(/rushBuildCacheWriteAllowed: \$\{\{ (.+) \}\}/)?.[1];
  assert.ok(groupGuard);
  assert.equal(writerOptIn, groupGuard);
  assert.ok(!groupGuard.includes("Manual"));
  assert.ok(!groupGuard.includes("PullRequest"));
});

test("wire every Azure reader to the runtime cache configuration without enabling later operations", () => {
  for (const file of ["templates/core-build.yaml", "templates/integration-test-steps.yaml", "jobs/docs-build.yaml"]) {
    const yaml = readFileSync(path.join(__dirname, "../../config/azure-pipelines", file), "utf8");
    assert.ok(yaml.includes("node common/scripts/set-rush-write-cache-variables.js"));
    assert.ok(yaml.includes("RUSH_BUILD_CACHE_ENABLED: $(RushBuildCacheEnabled)"));
    if (file !== "templates/core-build.yaml") {
      assert.ok(yaml.includes("ITWIN_RUSH_CACHE_WRITE_ENABLED: false"));
      assert.ok(yaml.includes("RUSH_BUILD_CACHE_WRITE_ALLOWED: 0"));
    }
  }
});

test("emit runtime variables without credentials", () => {
  const output = execFileSync(process.execPath, [path.join(__dirname, "../set-rush-write-cache-variables.js")], {
    env: { ...trusted, RUSH_BUILD_CACHE_CREDENTIAL: "do-not-log-this" },
    encoding: "utf8",
  });
  for (const [name, value] of Object.entries(getCacheVariables(trusted)))
    assert.ok(output.includes(`##vso[task.setvariable variable=${name};]${value}`));
  assert.ok(!output.includes("do-not-log-this"));
  assert.ok(!output.includes("variable=RUSH_BUILD_CACHE_ENABLED;"));
});
