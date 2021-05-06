/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Volume } from "memfs";
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import { ufs } from "unionfs";
import { clearCache, clearFileSystem, getTestConfig, runWebpack } from "./TestUtils";
import { addCopyFilesSuffix, addExternalPrefix, copyFilesRule, handlePrefixedExternals, RequireMagicCommentsPlugin } from "../plugins/RequireMagicCommentsPlugin";
import { ExternalsPlugin } from "webpack";
import { setApplicationDir } from "../utils/paths";

describe("RequireMagicCommentsPlugin", () => {
  let testConfig: any;
  const vol = new Volume();

  beforeEach(() => {
    setApplicationDir(path.join(__dirname, "assets/require-magic-comments-plugin-test"));
    ufs
      .use(vol as any)
      .use(fs as any);
  });

  it("should work with external comments with custom handler", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require(/*test*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/node_modules/bar/index.js": `console.log("Module bar");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /test/i, handler: () => "bar", },]),];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);

    const result = await runWebpack(testConfig, vol);

    const logging = result.logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*test*/ - transformed "foo" => "bar" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*test*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nconsole.log("Module bar");\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("should work with external comments and addExternalPrefix handler", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require(/*webpack: external*/"foo");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *external/i, handler: addExternalPrefix, },]), new ExternalsPlugin("commonjs", handlePrefixedExternals),];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);

    const result = await runWebpack(testConfig, vol);

    const logging = result.logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "BeWebpack-EXTERNAL:foo" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: external*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nmodule.exports = require("foo");\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("should work with external comments and resolve not converted", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*test*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/node_modules/bar/index.js": `console.log("Module bar");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /test/i, handler: () => "bar", },]),];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);
    const result = await runWebpack(testConfig, vol);

    const logging = result.logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*test*/ - transformed "foo" => "bar" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/*require.resolve*/(/*test*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nconsole.log("Module bar");\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("should work with external comments and resolve converted", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*test*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/node_modules/bar/index.js": `console.log("Module bar");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /test/i, handler: () => "bar", convertResolve: true, },]),];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);
    const result = await runWebpack(testConfig, vol);

    const logging = result.logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(2);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Converting require.resolve => require for "foo" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);
    expect(logging[1].type).to.be.equal("log");
    expect(logging[1].message).to.include(`Handler for /*test*/ - transformed "foo" => "bar" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*test*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nconsole.log("Module bar");\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("shoudl work with external comments with resolve not converted and addExternalPrefix handler", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*webpack: external*/"foo");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *external/i, handler: addExternalPrefix, },]), new ExternalsPlugin("commonjs", handlePrefixedExternals),];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);
    const result = await runWebpack(testConfig, vol);

    const logging = result.logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "BeWebpack-EXTERNAL:foo" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/*require.resolve*/(/*webpack: external*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nmodule.exports = require("foo");\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("should work with external comments with resolve converted and addExternalPrefix handler", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*webpack: external*/"foo");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *external/i, handler: addExternalPrefix, convertResolve: true, },]), new ExternalsPlugin("commonjs", handlePrefixedExternals),];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);
    const result = await runWebpack(testConfig, vol);

    const logging = result.logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(2);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Converting require.resolve => require for "foo" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);
    expect(logging[1].type).to.be.equal("log");
    expect(logging[1].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "BeWebpack-EXTERNAL:foo" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: external*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nmodule.exports = require("foo");\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("should work with copyfile comments and addCopyFileSuffix handler", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require(/*webpack: copyfile*/"./bar.txt");`,
      "lib/test/assets/require-magic-comments-plugin-test/bar.txt": `This is bar.txt`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *copyfile/i, handler: addCopyFilesSuffix, },]),];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest, undefined, [copyFilesRule]);

    const result = await runWebpack(testConfig, ufs);

    const logging = result.logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*webpack: copyfile*/ - transformed "./bar.txt" => "./bar.txt?BeWebpack-COPYFILE}" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.include(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: copyfile*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/* WEBPACK VAR INJECTION */(function(__dirname) {module.exports = __webpack_require__(3).resolve(__dirname, __webpack_require__.p + "static/bar.91b123.txt");\n/* WEBPACK VAR INJECTION */}.call(this, "/"))\n\n/***/ }),\n`);

    const barTextPath = path.join(__dirname, "dist/static/bar.91b123.txt");
    const barTextContent = fs.readFileSync(barTextPath, "utf8");
    expect(barTextContent).to.be.equal("This is bar.txt");
  });

  it("should work with copyfile comments, addCopyFileSuffix, and resolve converted", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*webpack: copyfile*/"./bar.txt");`,
      "lib/test/assets/require-magic-comments-plugin-test/bar.txt": `This is bar.txt`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *copyfile/i, handler: addCopyFilesSuffix, convertResolve: true, },]),];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest, undefined, [copyFilesRule]);
    const result = await runWebpack(testConfig, ufs);

    const logging = result.logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(2);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Converting require.resolve => require for "./bar.txt" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);
    expect(logging[1].type).to.be.equal("log");
    expect(logging[1].message).to.include(`Handler for /*webpack: copyfile*/ - transformed "./bar.txt" => "./bar.txt?BeWebpack-COPYFILE}" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.include(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: copyfile*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/* WEBPACK VAR INJECTION */(function(__dirname) {module.exports = __webpack_require__(3).resolve(__dirname, __webpack_require__.p + "static/bar.91b123.txt");\n/* WEBPACK VAR INJECTION */}.call(this, "/"))\n\n/***/ }),\n`);

    const barTextPath = path.join(__dirname, "dist/static/bar.91b123.txt");
    const barTextContent = fs.readFileSync(barTextPath, "utf8");
    expect(barTextContent).to.be.equal("This is bar.txt");
  });

  it("should work with copyfile comments, addCopyFileSuffix, and resolve not converted", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*webpack: copyfile*/"./bar.txt");`,
      "lib/test/assets/require-magic-comments-plugin-test/bar.txt": `This is bar.txt`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *copyfile/i, handler: addCopyFilesSuffix, },]),];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest, undefined, [copyFilesRule]);
    const result = await runWebpack(testConfig, ufs);

    const logging = result.logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*webpack: copyfile*/ - transformed "./bar.txt" => "./bar.txt?BeWebpack-COPYFILE}" at lib\\test\\assets\\require-magic-comments-plugin-test\\test.js`);

    const testModulePath = path.join(__dirname, "dist/test.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.include(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/*require.resolve*/(/*webpack: copyfile*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/* WEBPACK VAR INJECTION */(function(__dirname) {module.exports = __webpack_require__(3).resolve(__dirname, __webpack_require__.p + "static/bar.91b123.txt");\n/* WEBPACK VAR INJECTION */}.call(this, "/"))\n\n/***/ }),\n`);

    const barTextPath = path.join(__dirname, "dist/static/bar.91b123.txt");
    const barTextContent = fs.readFileSync(barTextPath, "utf8");
    expect(barTextContent).to.be.equal("This is bar.txt");
  });

  afterEach(() => {
    vol.reset();
    clearFileSystem(__dirname);
    clearCache(__dirname);
  });
});
