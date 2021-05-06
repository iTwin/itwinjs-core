/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Volume } from "memfs";
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import { clearCache, clearFileSystem, getTestConfig, runWebpack } from "./TestUtils";
import { IgnoreOptionalDependenciesPlugin } from "../plugins/OptionalDependenciesPlugin";
import { setApplicationDir } from "../utils/paths";

describe("OptionalDependenciesPlugin", () => {
  let testConfig: any;
  const vol = new Volume();

  beforeEach(() => {
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

    const result = await runWebpack(testConfig, vol);

    const logging = result.logging;
    expect(logging).to.not.have.property("CopyBentleyStaticResourcesPlugin");

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(
      `(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\nconst foo = __webpack_require__(2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\nconst bar = __webpack_require__(3);\n\n/***/ }),\n/* 3 */\n/***/ (function(module, exports) {\n\nconsole.log("This is bar");\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("should ignore optional dependency in try/catch", async () => {
    vol.fromJSON({
      "lib/test/assets/optional-dependencies-plugin-test/test.js": `const foo = require("foo");`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/index.js": `try {const bar = require("./bar");} catch {}`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/bar.js": `console.log("This is bar");`,
    });

    const result = await runWebpack(testConfig, vol);

    const logging = result.logging.IgnoreOptionalDependenciesPlugin.entries;
    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Ignoring require("./bar") at lib\\test\\assets\\optional-dependencies-plugin-test\\node_modules\\foo\\index.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(
      `(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\nconst foo = __webpack_require__(2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\ntry {const bar = require("./bar");} catch {}\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("should ignore critical dependency", async () => {
    vol.fromJSON({
      "lib/test/assets/optional-dependencies-plugin-test/test.js": `const foo = require("foo");`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/index.js": `const pathBar = "./bar";const bar = require(pathBar);`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/bar.js": `console.log("This is bar");`,
    });

    const result = await runWebpack(testConfig, vol);

    const logging = result.logging.IgnoreOptionalDependenciesPlugin.entries;
    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Ignoring require(<<expression>>) at lib\\test\\assets\\optional-dependencies-plugin-test\\node_modules\\foo\\index.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.equal(
      `(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\nconst foo = __webpack_require__(2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nconst pathBar = "./bar";const bar = require(pathBar);\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("should ignore non-call use of require", async () => {
    vol.fromJSON({
      "lib/test/assets/optional-dependencies-plugin-test/test.js": `const foo = require("foo");`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/index.js": `const optional = true;let req = (optional) ? require : console.log;const bar = req("./bar");`,
      "lib/test/assets/optional-dependencies-plugin-test/node_modules/foo/bar.js": `console.log("This is bar");`,
    });

    const result = await runWebpack(testConfig, vol);

    const logging = result.logging.IgnoreOptionalDependenciesPlugin.entries;
    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.equal("log");
    expect(logging[0].message).to.include(`Ignoring non-call require expression at lib\\test\\assets\\optional-dependencies-plugin-test\\node_modules\\foo\\index.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.equal(
      `(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\nconst foo = __webpack_require__(2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nconst optional = true;let req = (optional) ? require : console.log;const bar = req("./bar");\n\n/***/ })\n],[[0,1]]]);`);
  });

  afterEach(() => {
    vol.reset();
    fs.removeSync("lib/test/dist/");
    clearFileSystem(__dirname);
    clearCache(__dirname);
  });
});
