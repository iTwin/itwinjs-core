/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const template = readFileSync(path.join(__dirname, "../../config/azure-pipelines/templates/rush-build-step.yaml"), "utf8").replace(/\r\n/g, "\n");
const probe = template.match(/node -e "([\s\S]*?)" --/)?.[1];
assert.ok(probe, "Test the inline probe that runs in Azure.");

function select(mode, env = {}, { missing = false, legacy = false } = {}) {
  const lines = [];
  vm.runInNewContext(probe, {
    process: { argv: ["node", mode], env: Object.freeze(env) },
    console: { log: (line) => lines.push(line) },
    require(name) {
      if (name === "node:fs")
        return { existsSync: () => !missing };
      assert.equal(name, "./common/scripts/run-rush-build.js");
      assert.ok(!missing, "Don't load a wrapper absent from the checkout.");
      return legacy ? {} : require("../run-rush-build.js");
    },
  });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^##vso\[task.setvariable variable=ITWIN_RUSH_BUILD_COMMAND\](cached|build|rebuild)$/);
  return lines[0].split("]")[1];
}

test("ordinary reads and writes select the wrapper, not an incremental fallback", () => {
  for (const mode of ["read", "write"])
    assert.equal(select(mode), "cached");
  assert.equal(select("off"), "build");
  assert.equal(select("read", {}, { missing: true }), "build");
});

test("native validation only uses the wrapper for scoped reads", () => {
  for (const env of [{ ITWIN_NATIVE_PR_VALIDATION: "True" }, { IMODELJS_NATIVE_OVERRIDE: "/candidate" }]) {
    assert.equal(select("read", env), "cached");
    assert.equal(select("write", env), "rebuild");
    assert.equal(select("read", env, { missing: true }), "rebuild");
    assert.equal(select("read", env, { legacy: true }), "rebuild");
    assert.equal(select("off", env), "rebuild");
  }
});

test("a runtime off request takes precedence over the template cache mode", () => {
  for (const mode of ["read", "write"]) {
    assert.equal(select(mode, { RUSH_BUILD_CACHE_ENABLED: "0" }), "build");
    assert.equal(select(mode, { ITWIN_NATIVE_PR_VALIDATION: "true", RUSH_BUILD_CACHE_ENABLED: "0" }), "rebuild");
  }
});

test("the probe gets no credential; only the cached step maps credentials", () => {
  const [, probeStep, cached, fallback] = template.split(/^  - script: /m);
  assert.match(probeStep, /RUSH_BUILD_CACHE_CREDENTIAL: ""/);
  assert.match(cached, /^node common\/scripts\/run-rush-build\.js \$\{\{ parameters\.cacheMode \}\} \$\{\{ parameters\.args \}\}/);
  assert.match(cached, /condition: and\(succeeded\(\), eq\(variables\['ITWIN_RUSH_BUILD_COMMAND'\], 'cached'\)\)/);
  assert.ok(cached.includes("'$(RushBuildCacheWriteSAS)'") && cached.includes("'$(RushBuildCacheReadSAS)'"));
  assert.doesNotMatch(probeStep + fallback, /\$\(RushBuildCache(Read|Write)SAS\)/);
});

test("the fallback invokes the stable installer with both cache switches off and no overrides", () => {
  const fallback = template.split(/^  - script: /m)[3];
  assert.match(fallback, /^node common\/scripts\/install-run-rush\.js \$\(ITWIN_RUSH_BUILD_COMMAND\) \$\{\{ parameters\.args \}\}/);
  assert.match(fallback, /condition: and\(succeeded\(\), in\(variables\['ITWIN_RUSH_BUILD_COMMAND'\], 'build', 'rebuild'\)\)/);
  for (const name of ["RUSH_BUILD_CACHE_ENABLED", "RUSH_BUILD_CACHE_WRITE_ALLOWED"])
    assert.ok(fallback.includes(`${name}: "0"`), name);
  for (const name of ["RUSH_BUILD_CACHE_CREDENTIAL", "RUSH_BUILD_CACHE_OVERRIDE_JSON", "RUSH_BUILD_CACHE_OVERRIDE_JSON_FILE_PATH", "ITWIN_NATIVE_CACHE_KEY"])
    assert.ok(fallback.includes(`${name}: ""`), name);
});
