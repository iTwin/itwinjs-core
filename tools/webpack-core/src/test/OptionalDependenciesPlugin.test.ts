/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
import { Volume } from "memfs";
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import { clearCache, clearFileSystem, getTestConfig, runWebpack } from "./TestUtils";
import { IgnoreOptionalDependenciesPlugin } from "../plugins/OptionalDependenciesPlugin";
import { resetPaths, setApplicationDir } from "../utils/paths";

describe("OptionalDependenciesPlugin", () => {
  let testConfig: any;
  const vol = new Volume();

  beforeEach(function () {
    setApplicationDir(path.join(__dirname, "assets/optional-dependencies-plugin-test"));
    testConfig =
      getTestConfig(
        "assets/optional-dependencies-plugin-test/test.js",
        [new IgnoreOptionalDependenciesPlugin(["foo"])]);
  });

  it("should work without optional dependencies", async () => {
    vol.fromJSON({
      "lib/test/assets/optional-dependencies-plugin-test/test.js": `const foo = require("foo");`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/index.js": `const bar = require("./bar");`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/bar.js": `console.log("This is bar");`,
    });

    await runWebpack(testConfig, vol);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8")).to.matchSnapshot();
  });

  it("should ignore optional dependency in try/catch", async () => {
    vol.fromJSON({
      "lib/test/assets/optional-dependencies-plugin-test/test.js": `const foo = require("foo");`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/index.js": `try {const bar = require("./bar");} catch {}`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/bar.js": `console.log("This is bar");`,
    });

    const result = await runWebpack(testConfig, vol);
    expect(result.logging.IgnoreOptionalDependenciesPlugin.entries[0].message).to.include(`Ignoring require("./bar")`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8")).to.matchSnapshot();
  });

  it("should ignore critical dependency", async () => {
    vol.fromJSON({
      "lib/test/assets/optional-dependencies-plugin-test/test.js": `const foo = require("foo");`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/index.js": `const pathBar = "./bar";const bar = require(pathBar);`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/bar.js": `console.log("This is bar");`,
    });

    const result = await runWebpack(testConfig, vol);
    expect(result.logging.IgnoreOptionalDependenciesPlugin.entries[0].message).to.include(`Ignoring require(<<expression>>)`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8")).to.matchSnapshot();
  });

  it("should ignore non-call use of require", async () => {
    vol.fromJSON({
      "lib/test/assets/optional-dependencies-plugin-test/test.js": `const foo = require("foo");`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/index.js": `const optional = true;let req = (optional) ? require : console.log;const bar = req("./bar");`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/bar.js": `console.log("This is bar");`,
    });

    const result = await runWebpack(testConfig, vol);
    expect(result.logging.IgnoreOptionalDependenciesPlugin.entries[0].message).to.include("Ignoring non-call require expression");
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8")).to.matchSnapshot();
  });

  afterEach(() => {
    resetPaths();
    vol.reset();
    clearFileSystem(__dirname);
    clearCache(__dirname);
  });
});
