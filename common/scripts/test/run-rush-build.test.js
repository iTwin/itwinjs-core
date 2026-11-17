/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { getBuildCacheConfig, runRushBuild } = require("../run-rush-build.js");

for (const mode of ["off", "read", "write"]) {
  test(`${mode} configures cache reads and shared-cache writes`, () => {
    const config = getBuildCacheConfig(mode, {});
    assert.equal(config.buildCacheEnabled, mode !== "off");
    assert.equal(config.azureBlobStorageConfiguration.isCacheWriteAllowed, mode === "write");
  });

  test(`${mode} disables caching for untracked native overrides`, () => {
    const config = getBuildCacheConfig(mode, { IMODELJS_NATIVE_OVERRIDE: "/tmp/native-under-test" });
    assert.equal(config.buildCacheEnabled, false);
    assert.equal(config.azureBlobStorageConfiguration.isCacheWriteAllowed, false);
  });

  test(`${mode} disables caching for native PR validation without an override path`, () => {
    for (const value of ["true", "True"]) {
      const config = getBuildCacheConfig(mode, { ITWIN_NATIVE_PR_VALIDATION: value });
      assert.equal(config.buildCacheEnabled, false);
      assert.equal(config.azureBlobStorageConfiguration.isCacheWriteAllowed, false);
    }
    assert.equal(getBuildCacheConfig(mode, { ITWIN_NATIVE_PR_VALIDATION: "false" }).buildCacheEnabled, mode !== "off");
  });
}

test("reject unknown modes before starting a build", (t) => {
  let started = false;
  t.mock.method(childProcess, "spawnSync", () => { started = true; });
  for (const mode of [undefined, "true", "unknown"])
    assert.throws(() => runRushBuild(mode, [], {}), /Cache mode must be off, read, or write/);
  assert.equal(started, false);
});

test("isolate the exact Node version without changing tracked configuration", () => {
  const first = getBuildCacheConfig("read", {}, "24.11.0");
  assert.notEqual(first.cacheHashSalt, getBuildCacheConfig("read", {}, "24.11.1").cacheHashSalt);
  assert.notEqual(first.cacheHashSalt, getBuildCacheConfig("read", {}, "22.11.0").cacheHashSalt);
  assert.equal(first.cacheEntryNamePattern, "[os]-[arch]-[hash]");
  assert.equal(first.azureBlobStorageConfiguration.storageContainerName, "itwincache-v2");
  assert.equal(first.cacheHashSalt, getBuildCacheConfig("write", {}, "24.11.0").cacheHashSalt);
  getBuildCacheConfig("write", {});
  const tracked = require("../../config/rush/build-cache.json");
  assert.equal(tracked.buildCacheEnabled, false);
  assert.equal(tracked.azureBlobStorageConfiguration.isCacheWriteAllowed, false);
});

test("scope configuration and credentials to the Rush build child process", (t) => {
  let call;
  t.mock.method(childProcess, "spawnSync", (...args) => { call = args; return { status: 0 }; });
  const env = Object.freeze({
    PATH: "test-path",
    RUSH_BUILD_CACHE_ENABLED: "0",
    RUSH_BUILD_CACHE_WRITE_ALLOWED: "1",
    RUSH_BUILD_CACHE_OVERRIDE_JSON: "old override",
    RUSH_BUILD_CACHE_OVERRIDE_JSON_FILE_PATH: "/old/cache-override.json",
    RUSH_BUILD_CACHE_CREDENTIAL: "do-not-log-this",
  });
  assert.equal(runRushBuild("read", ["-v", "--to", "example-project"], env), 0);
  assert.equal(call[0], process.execPath);
  assert.deepEqual(call[1], [path.join(__dirname, "../install-run-rush.js"), "build", "-v", "--to", "example-project"]);
  assert.equal(call[2].stdio, "inherit");
  const buildEnv = call[2].env;
  assert.equal(buildEnv.PATH, env.PATH);
  assert.equal(buildEnv.RUSH_BUILD_CACHE_CREDENTIAL, env.RUSH_BUILD_CACHE_CREDENTIAL);
  assert.equal(buildEnv.RUSH_BUILD_CACHE_ENABLED, undefined);
  assert.equal(buildEnv.RUSH_BUILD_CACHE_WRITE_ALLOWED, undefined);
  assert.equal(buildEnv.RUSH_BUILD_CACHE_OVERRIDE_JSON_FILE_PATH, undefined);
  const config = JSON.parse(buildEnv.RUSH_BUILD_CACHE_OVERRIDE_JSON);
  assert.equal(config.buildCacheEnabled, true);
  assert.equal(config.azureBlobStorageConfiguration.isCacheWriteAllowed, false);
  assert.ok(!buildEnv.RUSH_BUILD_CACHE_OVERRIDE_JSON.includes(env.RUSH_BUILD_CACHE_CREDENTIAL));
  assert.equal(env.RUSH_BUILD_CACHE_OVERRIDE_JSON, "old override");
});

test("disabled builds do not receive a cache credential", (t) => {
  let buildEnv;
  t.mock.method(childProcess, "spawnSync", (_exe, _args, options) => { buildEnv = options.env; return { status: 0 }; });
  for (const [mode, nativeEnv] of [["off", {}], ["write", { IMODELJS_NATIVE_OVERRIDE: "/tmp/native-under-test" }], ["write", { ITWIN_NATIVE_PR_VALIDATION: "true" }]]) {
    runRushBuild(mode, [], { ...nativeEnv, RUSH_BUILD_CACHE_ENABLED: "1", RUSH_BUILD_CACHE_WRITE_ALLOWED: "1", RUSH_BUILD_CACHE_CREDENTIAL: "do-not-log-this" });
    assert.equal(buildEnv.RUSH_BUILD_CACHE_CREDENTIAL, undefined);
    assert.equal(JSON.parse(buildEnv.RUSH_BUILD_CACHE_OVERRIDE_JSON).buildCacheEnabled, false);
  }
});

test("preserve build failures without logging credentials or subprocess errors", (t) => {
  let result = { status: 7 };
  const errors = [];
  t.mock.method(childProcess, "spawnSync", () => result);
  t.mock.method(console, "error", (message) => errors.push(message));
  assert.equal(runRushBuild("off", [], {}), 7);
  result = { status: null, signal: "SIGTERM" };
  assert.equal(runRushBuild("off", [], {}), 1);
  result = { error: new Error("do-not-log-this") };
  assert.equal(runRushBuild("off", [], {}), 1);
  assert.deepEqual(errors, ["Unable to start Rush build."]);
});

test("exclude environment-dependent app and full-stack builds from shared caching", () => {
  for (const folder of ["full-stack-tests/core", "test-apps/display-test-app", "test-apps/display-performance-test-app"]) {
    const config = JSON.parse(readFileSync(path.join(__dirname, "../../..", folder, "config/rush-project.json"), "utf8"));
    assert.equal(config.operationSettings.find((operation) => operation.operationName === "build").disableBuildCacheForOperation, true);
  }
});

test("prepare Electron and i18n test bundles after cacheable builds", () => {
  for (const [folder, webpackOutput, commands] of [
    ["core/electron", "lib/cjs/test/frontend/webpack", ["test:integration:frontend"]],
    ["core/i18n", "lib/cjs/test/webpack", ["test:chrome", "test:debug"]],
  ]) {
    const projectPath = path.join(__dirname, "../../..", folder);
    const { scripts } = JSON.parse(readFileSync(path.join(projectPath, "package.json"), "utf8"));
    assert.ok(scripts.build.startsWith(`rimraf -g ${webpackOutput} && `), folder);
    assert.ok(!scripts.build.includes("test:prepare"), folder);
    assert.ok(scripts["test:prepare"].startsWith("webpack --config "), folder);
    assert.ok(!Object.hasOwn(scripts, "webpack:test"), folder);
    for (const command of commands)
      assert.ok(scripts[command].startsWith("npm run -s test:prepare && certa "), `${folder}: ${command}`);
    const config = JSON.parse(readFileSync(path.join(projectPath, "config/rush-project.json"), "utf8"));
    assert.notEqual(config.operationSettings.find((operation) => operation.operationName === "build").disableBuildCacheForOperation, true);
  }
});

test("select the writer group and build mode from one CI/ref decision", () => {
  const pipeline = readFileSync(path.join(__dirname, "../../config/azure-pipelines/jobs/fast-ci.yaml"), "utf8");
  const mode = pipeline.match(/- name: cacheMode\n\s+value: (.+)\n\s+readonly: true/)?.[1];
  assert.ok(mode?.includes("'IndividualCI', 'BatchedCI'"));
  assert.ok(mode.includes("'refs/heads/master'"));
  assert.ok(mode.includes("'refs/heads/release/'"));
  assert.ok(!mode.includes("Manual"));
  assert.ok(!mode.includes("PullRequest"));
  assert.ok(pipeline.includes("${{ if eq(variables.cacheMode, 'write') }}:"));
  assert.ok(pipeline.includes("cacheMode: ${{ variables.cacheMode }}"));
});

test("configure only build processes, not later test/docs operations", () => {
  for (const file of ["templates/core-build.yaml", "templates/integration-test-steps.yaml", "jobs/docs-build.yaml"]) {
    const yaml = readFileSync(path.join(__dirname, "../../config/azure-pipelines", file), "utf8");
    assert.ok(yaml.includes("node common/scripts/run-rush-build.js "), file);
    assert.ok(yaml.includes("RUSH_BUILD_CACHE_CREDENTIAL: $(RushBuildCacheReadSAS)"), file);
    assert.ok(!yaml.includes("RUSH_BUILD_CACHE_ENABLED:"), file);
    assert.ok(!yaml.includes("RUSH_BUILD_CACHE_WRITE_ALLOWED:"), file);
    assert.ok(!yaml.includes("RushBuildCacheEnabled"), file);
    if (file !== "templates/core-build.yaml")
      assert.ok(!yaml.includes("RushBuildCacheWriteSAS"), file);
  }
});

test("retain the native-validation signal for shared-template callers", () => {
  const yaml = readFileSync(path.join(__dirname, "../../config/azure-pipelines/templates/core-build.yaml"), "utf8");
  assert.match(yaml, /name: nativePrVal\s+type: boolean\s+default: false/);
  assert.match(yaml, /\$\{\{ if parameters\.nativePrVal \}\}:\s+ITWIN_NATIVE_PR_VALIDATION: "true"/);
  assert.ok(yaml.includes("run-rush-build.js ${{ iif(parameters.nativePrVal, 'off', parameters.cacheMode) }}"));
  assert.match(yaml, /\$\{\{ elseif eq\(parameters\.cacheMode, 'write'\) \}\}:\s+RUSH_BUILD_CACHE_CREDENTIAL: \$\(RushBuildCacheWriteSAS\)/);
  assert.match(yaml, /\$\{\{ elseif eq\(parameters\.cacheMode, 'read'\) \}\}:\s+RUSH_BUILD_CACHE_CREDENTIAL: \$\(RushBuildCacheReadSAS\)/);
});

test("keep migrated readers separate from the legacy credential group", () => {
  for (const file of ["jobs/fast-ci.yaml", "jobs/docs-ci.yaml", "integration-pr-validation.yaml", "integration-validation.yaml", "integration-client-regression-pr-validation.yaml"]) {
    const yaml = readFileSync(path.join(__dirname, "../../config/azure-pipelines", file), "utf8");
    assert.ok(yaml.includes("- group: Rush Build Cache Reader SAS Token"), file);
    assert.ok(!yaml.includes("- group: Rush Build Cache SAS Token"), file);
  }
});
