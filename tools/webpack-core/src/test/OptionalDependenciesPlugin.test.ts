/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Volume } from "memfs";
import { expect } from "chai";
import * as path from "path";
import * as webpack from "webpack";
import * as fs from "fs-extra";
import { createTestCompiler, getTestConfig } from "./TestUtils";
import { IgnoreOptionalDependenciesPlugin } from "../plugins/OptionalDependenciesPlugin";

describe("OptionalDependenciesPlugin", () => {
  let testConfig: any;
  let testCompiler: any;
  const vol = new Volume();

  before(() => {
    /* eslint-disable @typescript-eslint/naming-convention */
    vol.fromJSON({
      "lib/test/assets/optional-dependencies-plugin-test/a/optionalTestA.js": `const optionalA = require("optional-a");`,
      "lib/test/assets/optional-dependencies-plugin-test/a/node_modules/optional-a/index.js": `const a = require("./a");`,
      "lib/test/assets/optional-dependencies-plugin-test/a/node_modules/optional-a/a.js": `console.log("Test A");`,
      "lib/test/assets/optional-dependencies-plugin-test/b/optionalTestB.js": `const optionalB = require("optional-b");`,
      "lib/test/assets/optional-dependencies-plugin-test/b/node_modules/optional-b/index.js": `try {\n  const b = require("./b");\n} catch {\n\n}`,
      "lib/test/assets/optional-dependencies-plugin-test/b/node_modules/optional-b/b.js": `console.log("Test B");`,
      "lib/test/assets/optional-dependencies-plugin-test/c/optionalTestC.js": `const optionalC = require("optional-c");`,
      "lib/test/assets/optional-dependencies-plugin-test/c/node_modules/optional-c/index.js": `const pathC = "./c";\nconst c = require(pathC);`,
      "lib/test/assets/optional-dependencies-plugin-test/c/node_modules/optional-c/c.js": `console.log("Test C");`,
      "lib/test/assets/optional-dependencies-plugin-test/d/optionalTestD.js": `const optionalD = require("optional-d");`,
      "lib/test/assets/optional-dependencies-plugin-test/d/node_modules/optional-d/index.js": `const optional = true;\nlet req = (optional) ? require : console.log;\nconst d = req("./d");`,
      "lib/test/assets/optional-dependencies-plugin-test/d/node_modules/optional-d/d.js": `console.log("Test D");`,
    });
    /* eslint-enalbe @typescript-eslint/naming-convention */
  });

  it("Sucess without optional dependencies", async () => {
    testConfig =
      getTestConfig(
        "assets/optional-dependencies-plugin-test/a/optionalTestA.js",
        new IgnoreOptionalDependenciesPlugin([
          "optional-a",
        ]));
    testCompiler = createTestCompiler(webpack, testConfig, vol);
    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging;

    expect(logging).to.not.have.property("CopyBentleyStaticResourcesPlugin");

    const testModulePath = path.join(__dirname, "dist/optionalTestA.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(
      `(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\nconst optionalA = __webpack_require__(2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\nconst a = __webpack_require__(3);\n\n/***/ }),\n/* 3 */\n/***/ (function(module, exports) {\n\nconsole.log("Test A");\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("success with ignoring optional dependency in try/catch", async () => {
    testConfig =
      getTestConfig(
        "assets/optional-dependencies-plugin-test/b/optionalTestB.js",
        new IgnoreOptionalDependenciesPlugin([
          "optional-b",
        ]));
    testCompiler = createTestCompiler(webpack, testConfig, vol);
    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.IgnoreOptionalDependenciesPlugin.entries;

    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Ignoring require("./b") at lib\\test\\assets\\optional-dependencies-plugin-test\\b\\node_modules\\optional-b\\index.js`);

    const testModulePath = path.join(__dirname, "dist/optionalTestB.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(
      `(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\nconst optionalB = __webpack_require__(2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\ntry {\n  const b = require("./b");\n} catch {\n\n}\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("success with ignoring critical dependency", async () => {
    testConfig =
      getTestConfig(
        "assets/optional-dependencies-plugin-test/c/optionalTestC.js",
        new IgnoreOptionalDependenciesPlugin([
          "optional-c",
        ]));
    testCompiler = createTestCompiler(webpack, testConfig, vol);
    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.IgnoreOptionalDependenciesPlugin.entries;

    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Ignoring require(<<expression>>) at lib\\test\\assets\\optional-dependencies-plugin-test\\c\\node_modules\\optional-c\\index.js`);

    const testModulePath = path.join(__dirname, "dist/optionalTestC.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(
      `(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\nconst optionalC = __webpack_require__(2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nconst pathC = "./c";\nconst c = require(pathC);\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("success with ignoring non-call use of require", async () => {
    testConfig =
      getTestConfig(
        "assets/optional-dependencies-plugin-test/d/optionalTestD.js",
        new IgnoreOptionalDependenciesPlugin([
          "optional-d",
        ]));
    testCompiler = createTestCompiler(webpack, testConfig, vol);
    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.IgnoreOptionalDependenciesPlugin.entries;

    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Ignoring non-call require expression at lib\\test\\assets\\optional-dependencies-plugin-test\\d\\node_modules\\optional-d\\index.js`);

    const testModulePath = path.join(__dirname, "dist/optionalTestD.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(
      `(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\nconst optionalD = __webpack_require__(2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nconst optional = true;\nlet req = (optional) ? require : console.log;\nconst d = req("./d");\n\n/***/ })\n],[[0,1]]]);`);
  });
});
