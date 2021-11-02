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

describe.only("strip-assert-loader", () => {
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
    expect(result.errors.length).to.equal(0);
    expect(result.warnings.length).to.equal(0);

    const bundleContents = vol.readFileSync(path.join(result.outputPath, "test.js"), "utf8");
    expect(bundleContents).to.contain(`const core_bentley_1 = __webpack_require__(2);\n(0, /*@__PURE__*/(function(){}))(false);`);
  });

  it("should strip esm asserts from core-bentley package", async () => {
    vol.fromJSON({
      [loaderPath]: loaderContents,
      "lib/test/assets/strip-assert-loader-test/test.js": `import { assert } from "@itwin/core-bentley";\nassert("THIS WAS A TEST ASSERTION");`,
    });
    testConfig = getTestConfig("assets/strip-assert-loader-test/test.js", [], ["@itwin/core-bentley"], [loaderRule]);

    const result = await runWebpack(testConfig, vol);
    expect(result.errors.length).to.equal(0);
    expect(result.warnings.length).to.equal(0);

    const bundleContents = vol.readFileSync(path.join(result.outputPath, "test.js"), "utf8");
    expect(bundleContents).to.contain(`/*@__PURE__*/(function(){}))("THIS WAS A TEST ASSERTION");`);
  });

  afterEach(() => {
    vol.reset();
    clearFileSystem(__dirname);
    clearCache(__dirname);
  });
});
