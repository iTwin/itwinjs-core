/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Volume } from "memfs";
import { expect } from "chai";
import * as path from "path";
import * as webpack from "webpack";
import * as fs from "fs-extra";
import { ufs } from "unionfs";
import { createTestCompiler, getRequireCopyConfig, getRequireExternalConfig } from "./TestUtils";
import { addCopyFilesSuffix, addExternalPrefix, copyFilesRule, handlePrefixedExternals, RequireMagicCommentsPlugin } from "../plugins/RequireMagicCommentsPlugin";
import { ExternalsPlugin } from "webpack";

describe("RequireMagicCommentsPlugin", () => {
  let testConfig: any;
  let testCompiler: any;
  const vol = new Volume();

  before(() => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/a/requireTestA.js": `require(/*webpack: external*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/a/node_modules/module-a/index.js": `console.log("Module A");`,
      "lib/test/assets/require-magic-comments-plugin-test/b/requireTestB.js": `require(/*webpack: external*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/c/requireTestC.js": `require.resolve(/*webpack: external*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/c/node_modules/module-c/index.js": `console.log("Module C");`,
      "lib/test/assets/require-magic-comments-plugin-test/d/requireTestD.js": `require.resolve(/*webpack: external*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/d/node_modules/module-d/index.js": `console.log("Module D");`,
      "lib/test/assets/require-magic-comments-plugin-test/e/requireTestE.js": `require.resolve(/*webpack: external*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/f/requireTestF.js": `require.resolve(/*webpack: external*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/g/requireTestG.js": `require(/*webpack: copyfile*/"./bar.txt");`,
      "lib/test/assets/require-magic-comments-plugin-test/g/bar.txt": `This is bar.txt`,
      "lib/test/assets/require-magic-comments-plugin-test/h/requireTestH.js": `require.resolve(/*webpack: copyfile*/"./foobar.txt");`,
      "lib/test/assets/require-magic-comments-plugin-test/h/foobar.txt": `This is foobar.txt`,
      "lib/test/assets/require-magic-comments-plugin-test/i/requireTestI.js": `require.resolve(/*webpack: copyfile*/"./barfoo.txt");`,
      "lib/test/assets/require-magic-comments-plugin-test/i/barfoo.txt": `This is barfoo.txt`,
    });
  });

  /* Test A */
  it("A: sucess with external comments with custom handler", async () => {
    testConfig =
      getRequireExternalConfig(
        "assets/require-magic-comments-plugin-test/a/requireTestA.js",
        [new RequireMagicCommentsPlugin([
          {
            test: /webpack: *external/i,
            handler: () => "module-a",
          },
        ]),
        new ExternalsPlugin("commonjs", handlePrefixedExternals),
        ]);
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "module-a" at lib\\test\\assets\\require-magic-comments-plugin-test\\a\\requireTestA.js`);

    const testModulePath = path.join(__dirname, "dist/requireTestA.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: external*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nconsole.log("Module A");\n\n/***/ })\n],[[0,1]]]);`);
  });

  /* Test B */
  it("B: sucess with external comments with addExternalPrefix handler", async () => {
    testConfig =
      getRequireExternalConfig(
        "assets/require-magic-comments-plugin-test/b/requireTestB.js",
        [new RequireMagicCommentsPlugin([
          {
            test: /webpack: *external/i,
            handler: addExternalPrefix,
          },
        ]),
        new ExternalsPlugin("commonjs", handlePrefixedExternals),
        ]);
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "BeWebpack-EXTERNAL:foo" at lib\\test\\assets\\require-magic-comments-plugin-test\\b\\requireTestB.js`);

    const testModulePath = path.join(__dirname, "dist/requireTestB.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: external*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nmodule.exports = require("foo");\n\n/***/ })\n],[[0,1]]]);`);
  });

  /* Test C */
  it("C: sucess with external comments with with resolve not converted", async () => {
    testConfig =
      getRequireExternalConfig(
        "assets/require-magic-comments-plugin-test/c/requireTestC.js",
        [new RequireMagicCommentsPlugin([
          {
            test: /webpack: *external/i,
            handler: () => "module-c",
          },
        ]),
        new ExternalsPlugin("commonjs", handlePrefixedExternals),
        ]);
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "module-c" at lib\\test\\assets\\require-magic-comments-plugin-test\\c\\requireTestC.js`);

    const testModulePath = path.join(__dirname, "dist/requireTestC.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/*require.resolve*/(/*webpack: external*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nconsole.log("Module C");\n\n/***/ })\n],[[0,1]]]);`);
  });

  /* Test D */
  it("D: sucess with external comments with with resolve converted", async () => {
    testConfig =
      getRequireExternalConfig(
        "assets/require-magic-comments-plugin-test/d/requireTestD.js",
        [new RequireMagicCommentsPlugin([
          {
            test: /webpack: *external/i,
            handler: () => "module-d",
            convertResolve: true,
          },
        ]),
        new ExternalsPlugin("commonjs", handlePrefixedExternals),
        ]);
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(2);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Converting require.resolve => require for "foo" at lib\\test\\assets\\require-magic-comments-plugin-test\\d\\requireTestD.js`);
    expect(logging[1].type).to.be.equal("log");
    expect(logging[1].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "module-d" at lib\\test\\assets\\require-magic-comments-plugin-test\\d\\requireTestD.js`);

    const testModulePath = path.join(__dirname, "dist/requireTestD.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: external*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nconsole.log("Module D");\n\n/***/ })\n],[[0,1]]]);`);
  });

  /* Test E */
  it("E: sucess with external comments with with resolve not converted and addExternalPrefix handler", async () => {
    testConfig =
      getRequireExternalConfig(
        "assets/require-magic-comments-plugin-test/e/requireTestE.js",
        [new RequireMagicCommentsPlugin([
          {
            test: /webpack: *external/i,
            handler: addExternalPrefix,
          },
        ]),
        new ExternalsPlugin("commonjs", handlePrefixedExternals),
        ]);
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "BeWebpack-EXTERNAL:foo" at lib\\test\\assets\\require-magic-comments-plugin-test\\e\\requireTestE.js`);

    const testModulePath = path.join(__dirname, "dist/requireTestE.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/*require.resolve*/(/*webpack: external*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nmodule.exports = require("foo");\n\n/***/ })\n],[[0,1]]]);`);
  });

  /* Test F */
  it("F: sucess with external comments with with resolve converted and addExternalPrefix handler", async () => {
    testConfig =
      getRequireExternalConfig(
        "assets/require-magic-comments-plugin-test/f/requireTestF.js",
        [new RequireMagicCommentsPlugin([
          {
            test: /webpack: *external/i,
            handler: addExternalPrefix,
            convertResolve: true,
          },
        ]),
        new ExternalsPlugin("commonjs", handlePrefixedExternals),
        ]);
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(2);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Converting require.resolve => require for "foo" at lib\\test\\assets\\require-magic-comments-plugin-test\\f\\requireTestF.js`);
    expect(logging[1].type).to.be.equal("log");
    expect(logging[1].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "BeWebpack-EXTERNAL:foo" at lib\\test\\assets\\require-magic-comments-plugin-test\\f\\requireTestF.js`);

    const testModulePath = path.join(__dirname, "dist/requireTestF.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: external*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports) {\n\nmodule.exports = require("foo");\n\n/***/ })\n],[[0,1]]]);`);
  });

  it("G: sucess with copyfile comments with addCopyFileSuffix handler", async () => {
    ufs
      .use(vol as any)
      .use(fs as any);

    testConfig =
      getRequireCopyConfig(
        // "./assets/plugin-test/g/requireTestG.js",
        "assets/require-magic-comments-plugin-test/g/requireTestG.js",
        [new RequireMagicCommentsPlugin([
          {
            test: /webpack: *copyfile/i,
            handler: addCopyFilesSuffix,
          },
        ]),
        ]);
    testCompiler = createTestCompiler(webpack, testConfig, ufs);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*webpack: copyfile*/ - transformed "./bar.txt" => "./bar.txt?BeWebpack-COPYFILE}" at lib\\test\\assets\\require-magic-comments-plugin-test\\g\\requireTestG.js`);

    const testModulePath = path.join(__dirname, "dist/requireTestG.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.include(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: copyfile*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/* WEBPACK VAR INJECTION */(function(__dirname) {module.exports = __webpack_require__(3).resolve(__dirname, __webpack_require__.p + "static/bar.91b123.txt");\n/* WEBPACK VAR INJECTION */}.call(this, "/"))\n\n/***/ }),\n`);

    const barTextPath = path.join(__dirname, "dist/static/bar.91b123.txt");
    const barTextContent = fs.readFileSync(barTextPath, "utf8");
    expect(barTextContent).to.be.equal("This is bar.txt");
  });

  it("H: sucess with copyfile comments with addCopyFileSuffix and resolve converted", async () => {
    ufs
      .use(vol as any)
      .use(fs as any);

    testConfig =
      getRequireCopyConfig(
        "assets/require-magic-comments-plugin-test/h/requireTestH.js",
        [new RequireMagicCommentsPlugin([
          {
            test: /webpack: *copyfile/i,
            handler: addCopyFilesSuffix,
            convertResolve: true,
          },
        ]),
        ]);
    testCompiler = createTestCompiler(webpack, testConfig, ufs);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(2);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Converting require.resolve => require for "./foobar.txt" at lib\\test\\assets\\require-magic-comments-plugin-test\\h\\requireTestH.js`);
    expect(logging[1].type).to.be.equal("log");
    expect(logging[1].message).to.include(`Handler for /*webpack: copyfile*/ - transformed "./foobar.txt" => "./foobar.txt?BeWebpack-COPYFILE}" at lib\\test\\assets\\require-magic-comments-plugin-test\\h\\requireTestH.js`);

    const testModulePath = path.join(__dirname, "dist/requireTestH.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.include(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: copyfile*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/* WEBPACK VAR INJECTION */(function(__dirname) {module.exports = __webpack_require__(3).resolve(__dirname, __webpack_require__.p + "static/foobar.1914ec.txt");\n/* WEBPACK VAR INJECTION */}.call(this, "/"))\n\n/***/ }),\n`);

    const barTextPath = path.join(__dirname, "dist/static/foobar.1914ec.txt");
    const barTextContent = fs.readFileSync(barTextPath, "utf8");
    expect(barTextContent).to.be.equal("This is foobar.txt");
  });

  it("I: sucess with copyfile comments with addCopyFileSuffix and resolve not converted", async () => {
    ufs
      .use(vol as any)
      .use(fs as any);

    testConfig =
      getRequireCopyConfig(
        "assets/require-magic-comments-plugin-test/i/requireTestI.js",
        [new RequireMagicCommentsPlugin([
          {
            test: /webpack: *copyfile/i,
            handler: addCopyFilesSuffix,
          },
        ]),
        ]);
    testCompiler = createTestCompiler(webpack, testConfig, ufs);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.RequireMagicCommentsPlugin.entries;
    expect(logging.length).to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.include(`Handler for /*webpack: copyfile*/ - transformed "./barfoo.txt" => "./barfoo.txt?BeWebpack-COPYFILE}" at lib\\test\\assets\\require-magic-comments-plugin-test\\i\\requireTestI.js`);

    const testModulePath = path.join(__dirname, "dist/requireTestI.js");
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.include(`(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/*require.resolve*/(/*webpack: copyfile*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/* WEBPACK VAR INJECTION */(function(__dirname) {module.exports = __webpack_require__(3).resolve(__dirname, __webpack_require__.p + "static/barfoo.2fa8a0.txt");\n/* WEBPACK VAR INJECTION */}.call(this, "/"))\n\n/***/ }),\n`);

    const barTextPath = path.join(__dirname, "dist/static/barfoo.2fa8a0.txt");
    const barTextContent = fs.readFileSync(barTextPath, "utf8");
    expect(barTextContent).to.be.equal("This is barfoo.txt");
  });
});
