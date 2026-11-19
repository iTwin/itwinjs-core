/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const template = readFileSync(path.join(__dirname, "../../config/azure-pipelines/templates/rush-build-step.yaml"), "utf8");
const script = template.match(/node -e "([\s\S]*?)" --/)?.[1];
assert.ok(script, "The test must execute the actual inline bootstrap.");

function run(mode, env = {}, options = {}) {
  const original = Object.freeze({ ...env });
  const result = { calls: [], errors: [] };
  const runner = {
    ...(options.legacy ? {} : { nativeCacheKeyEnv: "ITWIN_NATIVE_CACHE_KEY" }),
    runRushBuild(...args) {
      result.calls.push({ runner: true, mode: args[0], args: Array.from(args[1]), env: { ...args[2] } });
      if (options.throwRunner)
        throw new Error("secret-sentinel");
      return options.status ?? 0;
    },
  };
  const process = { argv: ["node", mode, "-v", "--to", "example"], env: original, execPath: "node" };
  vm.runInNewContext(script, {
    process,
    console: { error: (message) => result.errors.push(message) },
    require(name) {
      if (name === "node:fs")
        return { existsSync: () => !options.missing };
      if (name === "node:path")
        return path;
      if (name === "node:child_process") {
        return { spawnSync(exe, args, settings) {
          result.calls.push({ exe, args: Array.from(args), env: { ...settings.env }, stdio: settings.stdio });
          return options.spawnResult ?? { status: options.status ?? 0 };
        } };
      }
      assert.equal(name, path.resolve("common/scripts/run-rush-build.js"));
      return runner;
    },
  });
  assert.deepEqual(original, env, "Never mutate the task environment.");
  return { ...result, exitCode: process.exitCode };
}

for (const mode of ["read", "write"]) {
  test(`${mode} delegates ordinary builds and forwards arguments/status`, () => {
    const result = run(mode, {}, { status: 7 });
    assert.equal(result.exitCode, 7);
    assert.equal(result.calls[0].runner, true);
    assert.equal(result.calls[0].mode, mode);
    assert.deepEqual(result.calls[0].args, ["-v", "--to", "example"]);
  });
}

test("the current runner advertises scoped native invalidation", () => {
  assert.equal(require("../run-rush-build.js").nativeCacheKeyEnv, "ITWIN_NATIVE_CACHE_KEY");
});

test("eligible native readers use the scoped runner", () => {
  for (const nativeEnv of [{ ITWIN_NATIVE_PR_VALIDATION: "True" }, { IMODELJS_NATIVE_OVERRIDE: "/candidate" }]) {
    const result = run("read", nativeEnv);
    assert.equal(result.calls[0].runner, true);
    assert.equal(result.calls[0].mode, "read");
  }
});

test("runtime cache-off wins even when template expansion selected read/write", () => {
  for (const mode of ["off", "read", "write"]) {
    const result = run(mode, {
      ITWIN_NATIVE_PR_VALIDATION: "true", RUSH_BUILD_CACHE_ENABLED: "0",
      RUSH_BUILD_CACHE_CREDENTIAL: "secret-sentinel", RUSH_BUILD_CACHE_OVERRIDE_JSON: "old override",
      RUSH_BUILD_CACHE_OVERRIDE_JSON_FILE_PATH: "/missing/file.json", ITWIN_NATIVE_CACHE_KEY: "old key",
    });
    const call = result.calls[0];
    assert.equal(call.runner, undefined);
    assert.equal(call.args[1], "rebuild");
    assert.equal(call.env.RUSH_BUILD_CACHE_ENABLED, "0");
    assert.equal(call.env.RUSH_BUILD_CACHE_WRITE_ALLOWED, "0");
    for (const name of ["RUSH_BUILD_CACHE_CREDENTIAL", "RUSH_BUILD_CACHE_OVERRIDE_JSON", "RUSH_BUILD_CACHE_OVERRIDE_JSON_FILE_PATH", "ITWIN_NATIVE_CACHE_KEY"])
      assert.equal(call.env[name], undefined, name);
  }
});

test("native preflight can force a compatible cache-off fallback", () => {
  const result = run("read", { ITWIN_NATIVE_PR_VALIDATION: "true", ITWIN_NATIVE_CACHE_MODE: "off" });
  assert.equal(result.calls[0].runner, undefined);
  assert.equal(result.calls[0].args[1], "rebuild");
});

test("old native checkouts rebuild without cache instead of loading an absent/unsafe runner", () => {
  for (const options of [{ missing: true }, { legacy: true }]) {
    const result = run("read", { IMODELJS_NATIVE_OVERRIDE: "/candidate", RUSH_BUILD_CACHE_CREDENTIAL: "reader" }, options);
    const call = result.calls[0];
    assert.equal(call.runner, undefined);
    assert.deepEqual(call.args.slice(1), ["rebuild", "-v", "--to", "example"]);
    assert.equal(call.env.RUSH_BUILD_CACHE_CREDENTIAL, undefined);
    assert.equal(call.env.RUSH_BUILD_CACHE_WRITE_ALLOWED, "0");
  }
});

test("native write requests never load a runner or forward a writer credential", () => {
  const result = run("write", { ITWIN_NATIVE_PR_VALIDATION: "true", RUSH_BUILD_CACHE_CREDENTIAL: "writer" });
  assert.equal(result.calls[0].runner, undefined);
  assert.equal(result.calls[0].args[1], "rebuild");
  assert.equal(result.calls[0].env.RUSH_BUILD_CACHE_CREDENTIAL, undefined);
});

test("ordinary cache-off and missing-runner fallbacks remain incremental", () => {
  for (const result of [run("off"), run("read", {}, { missing: true })]) {
    assert.equal(result.calls[0].args[1], "build");
    assert.equal(result.calls[0].env.RUSH_BUILD_CACHE_ENABLED, "0");
  }
});

test("fallback failures propagate without printing subprocess details", () => {
  const result = run("off", {}, { spawnResult: { error: new Error("secret-sentinel") } });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.errors, ["Unable to start Rush build."]);
  assert.equal(run("off", {}, { status: 9 }).exitCode, 9);
  assert.equal(run("read", {}, { throwRunner: true }).exitCode, 1);
});
