/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
import { Volume } from "memfs";
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import { clearCache, clearFileSystem, fsFromJson, getTestConfig, runWebpack } from "./TestUtils";
import { setApplicationDir } from "../utils/paths";

describe("strip-assert-loader", () => {
  let testConfig: any;
  const vol = new Volume();

  let loaderContents: string;
  const loaderPath = path.join(__dirname, "../loaders/strip-assert-loader.js");

  const loaderRule = {
    test: () => true,
    loader: loaderPath,
    enforce: "pre",
  };

  before(() => {
    setApplicationDir(path.join(__dirname, "assets/strip-assert-loader"));
    loaderContents = fs.readFileSync(loaderPath, "utf8");
  });

  it("should strip cjs asserts from core-bentley package", async () => {
    vol.fromJSON({
      [loaderPath]: loaderContents,
      "lib/test/assets/strip-assert-loader-test/test.js": `const core_bentley_1 = require("@itwin/core-bentley");\n(0, core_bentley_1.assert)(false);`,
    });
    testConfig = getTestConfig("assets/strip-assert-loader-test/test.js", [], ["@itwin/core-bentley"], [loaderRule]);

    const result = await runWebpack(testConfig, vol);
    expect(result.errors.length).to.equal(0, result.errors.join("\n"));
    expect(result.warnings.length).to.equal(0, result.warnings.join("\n"));

    const bundleContents = vol.readFileSync(path.join(result.outputPath, "test.js"), "utf8");
    expect(bundleContents).to.matchSnapshot();
    expect(bundleContents).to.not.contain(`core_bentley_1.assert`); // Sanity check - make sure nobody blindly updates snapshot :)
  });

  it("should strip esm asserts from core-bentley package", async () => {
    vol.fromJSON({
      [loaderPath]: loaderContents,
      "lib/test/assets/strip-assert-loader-test/test.js": `import { assert } from "@itwin/core-bentley";\nassert("THIS WAS A TEST ASSERTION");`,
    });
    testConfig = getTestConfig("assets/strip-assert-loader-test/test.js", [], ["@itwin/core-bentley"], [loaderRule]);

    const result = await runWebpack(testConfig, vol);
    expect(result.errors.length).to.equal(0, result.errors.join("\n"));
    expect(result.warnings.length).to.equal(0, result.warnings.join("\n"));

    const bundleContents = vol.readFileSync(path.join(result.outputPath, "test.js"), "utf8");
    expect(bundleContents).to.matchSnapshot();
    expect(bundleContents).to.not.contain("THIS WAS A TEST ASSERTION"); // Sanity check - make sure nobody blindly updates snapshot :)
  });

  it("should safely strip cjs asserts inside single-line if", async () => {
    vol.fromJSON({
      [loaderPath]: loaderContents,
      "lib/test/assets/strip-assert-loader-test/test.js": `const core_bentley_1 = require("@itwin/core-bentley");\nif (true) (0, core_bentley_1.assert)(false);`,
    });
    testConfig = getTestConfig("assets/strip-assert-loader-test/test.js", [], ["@itwin/core-bentley"], [loaderRule]);

    const result = await runWebpack(testConfig, vol);
    expect(result.errors.length).to.equal(0, result.errors.join("\n"));
    expect(result.warnings.length).to.equal(0, result.warnings.join("\n"));

    const bundleContents = vol.readFileSync(path.join(result.outputPath, "test.js"), "utf8");
    expect(bundleContents).to.matchSnapshot();
    expect(bundleContents).to.not.contain(`core_bentley_1.assert`); // Sanity check - make sure nobody blindly updates snapshot :)
  });

  it("should safely strip esm asserts inside single-line if", async () => {
    vol.fromJSON({
      [loaderPath]: loaderContents,
      "lib/test/assets/strip-assert-loader-test/test.js": `import { assert } from "@itwin/core-bentley";if (true)\nassert("THIS WAS A TEST ASSERTION");`,
    });
    testConfig = getTestConfig("assets/strip-assert-loader-test/test.js", [], ["@itwin/core-bentley"], [loaderRule]);

    const result = await runWebpack(testConfig, vol);
    expect(result.errors.length).to.equal(0, result.errors.join("\n"));
    expect(result.warnings.length).to.equal(0, result.warnings.join("\n"));

    const bundleContents = vol.readFileSync(path.join(result.outputPath, "test.js"), "utf8");
    expect(bundleContents).to.matchSnapshot();
    expect(bundleContents).to.not.contain("THIS WAS A TEST ASSERTION"); // Sanity check - make sure nobody blindly updates snapshot :)
  });

  it("should strip cjs asserts from _within_ core-bentley package", async () => {
    vol.fromJSON({
      [loaderPath]: loaderContents,
      "lib/test/assets/strip-assert-loader-test/test.js": `require("@itwin/core-bentley");`,
      "lib/test/assets/strip-assert-loader-test/node_modules/@itwin/core-bentley/package.json": `{"main": "lib/cjs/index.js"}`,
      "lib/test/assets/strip-assert-loader-test/node_modules/@itwin/core-bentley/lib/cjs/index.js": `const Assert_1 = require("./Assert");\n(0, Assert_1.assert)("THIS WAS A TEST ASSERTION");`,
      "lib/test/assets/strip-assert-loader-test/node_modules/@itwin/core-bentley/lib/cjs/Assert.js": `function assert(foo, bar) {console.log(foo,bar);} exports.assert = assert;`,
    });
    testConfig = getTestConfig("assets/strip-assert-loader-test/test.js", [], [], [loaderRule]);

    const result = await runWebpack(testConfig, vol);
    expect(result.errors.length).to.equal(0, result.errors.join("\n"));
    expect(result.warnings.length).to.equal(0, result.warnings.join("\n"));

    const bundleContents = vol.readFileSync(path.join(result.outputPath, "test.js"), "utf8");
    expect(bundleContents).to.matchSnapshot();
    expect(bundleContents).to.not.contain("THIS WAS A TEST ASSERTION"); // Sanity check - make sure nobody blindly updates snapshot :)
  });

  it("should strip esm asserts from _within_ core-bentley package", async () => {
    vol.fromJSON({
      [loaderPath]: loaderContents,
      "lib/test/assets/strip-assert-loader-test/test.js": `import "@itwin/core-bentley";`,
      "lib/test/assets/strip-assert-loader-test/node_modules/@itwin/core-bentley/package.json": `{"module": "lib/esm/index.js"}`,
      "lib/test/assets/strip-assert-loader-test/node_modules/@itwin/core-bentley/lib/esm/index.js": `import { assert } from "./Assert";\nassert("THIS WAS A TEST ASSERTION");`,
      "lib/test/assets/strip-assert-loader-test/node_modules/@itwin/core-bentley/lib/esm/Assert.js": `export function assert(foo, bar) {console.log(foo,bar);}`,
    });
    testConfig = getTestConfig("assets/strip-assert-loader-test/test.js", [], [], [loaderRule]);

    const result = await runWebpack(testConfig, vol);
    expect(result.errors.length).to.equal(0, result.errors.join("\n"));
    expect(result.warnings.length).to.equal(0, result.warnings.join("\n"));

    const bundleContents = vol.readFileSync(path.join(result.outputPath, "test.js"), "utf8");
    expect(bundleContents).to.matchSnapshot();
    expect(bundleContents).to.not.contain("THIS WAS A TEST ASSERTION"); // Sanity check - make sure nobody blindly updates snapshot :)
  });

  it("should safely handle commented-out asserts", async () => {
    vol.fromJSON({
      [loaderPath]: loaderContents,
      "lib/test/assets/strip-assert-loader-test/test.js": `import { assert } from "@itwin/core-bentley";\n// assert("THIS WAS A TEST ASSERTION");\n/* assert(false); */`,
    });
    testConfig = getTestConfig("assets/strip-assert-loader-test/test.js", [], ["@itwin/core-bentley"], [loaderRule]);

    const result = await runWebpack(testConfig, vol);
    expect(result.errors.length).to.equal(0, result.errors.join("\n"));
    expect(result.warnings.length).to.equal(0, result.warnings.join("\n"));

    const bundleContents = vol.readFileSync(path.join(result.outputPath, "test.js"), "utf8");
    expect(bundleContents).to.matchSnapshot();
  });

  afterEach(() => {
    vol.reset();
    clearFileSystem(__dirname);
    clearCache(__dirname);
  });
});
