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
import { CopyExternalsPlugin } from "../plugins/CopyExternalsPlugin";
import { setApplicationDir } from "../utils/paths";

describe("CopyExternalsPlugin", () => {
  let testConfig: any;
  const vol = new Volume();

  before(() => {
    setApplicationDir(path.join(__dirname, "assets/copy-externals-plugin-test"));
  });

  it("skips electron", async () => {
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as electron from "electron";`,
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["electron"]);

    const result = await runWebpack(testConfig);
    expect(result.logging).to.not.haveOwnProperty("CopyExternalsPlugin");
    expect(fs.existsSync(path.join(__dirname, "dist/node_modules"))).to.be.false;
  });

  it("should copy direct external dependencies", async () => {
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as foo from "foo";`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/foo/index.js": `console.log("This is foo");`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/foo/package.json": `{"name": "foo", "dependencies": {"a": "", "b": "", "c":""}}`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/a/index.js": `console.log("This is a");`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/a/package.json": `{"name": "a"}`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/b/index.js": `console.log("This is b");`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/b/package.json": `{"name": "b"}`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/c/index.js": `console.log("This is c");`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/c/package.json": `{"name": "c"}`,
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["foo"]);

    await runWebpack(testConfig);
    expect(fs.readFileSync(path.join(__dirname, "dist/node_modules/foo/index.js"), "utf8")).to.equal(`console.log("This is foo");`);
    expect(fs.readFileSync(path.join(__dirname, "dist/node_modules/a/index.js"), "utf8")).to.equal(`console.log("This is a");`);
    expect(fs.readFileSync(path.join(__dirname, "dist/node_modules/b/index.js"), "utf8")).to.equal(`console.log("This is b");`);
    expect(fs.readFileSync(path.join(__dirname, "dist/node_modules/c/index.js"), "utf8")).to.equal(`console.log("This is c");`);
  });

  it("should copy indirect dependencies with symlink", async () => {
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as a from "a";`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/a/package.json": `{"dependencies": {"b": ""}}`,
      "lib/test/assets/copy-externals-plugin-test/bar/node_modules/b/package.json": `{"name": "b", "dependencies": {"c": ""}}`,
      "lib/test/assets/copy-externals-plugin-test/bar/node_modules/c/package.json": `{"name": "c"}`,
    });
    fs.symlinkSync("../bar/node_modules/b", "lib/test/assets/copy-externals-plugin-test/node_modules/b", "junction");
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["a"]);

    const result = await runWebpack(testConfig);
    expect(result.logging.CopyExternalsPlugin.entries.length, "Length of entries should be 3").to.be.equal(3);
    expect(fs.existsSync(path.join(__dirname, "dist/node_modules/a"))).to.be.true;
    expect(fs.existsSync(path.join(__dirname, "dist/node_modules/b"))).to.be.true;
    expect(fs.existsSync(path.join(__dirname, "dist/node_modules/c"))).to.be.true;
  });

  it("should copy hoisted indirect dependencies", async () => {
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as foo from "foo";`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/foo/index.js": `import * as bar from "bar";`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/bar/index.js": `console.log("This is bar");`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/bar/package.json": "{}",
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["bar"]);

    await runWebpack(testConfig);
    expect(fs.existsSync(path.join(__dirname, "dist/node_modules/bar"))).to.be.true;
    expect(fs.readFileSync(path.join(__dirname, "dist/node_modules/bar/index.js"), "utf8")).to.equal(`console.log("This is bar");`);
  });

  it("should copy nested indirect dependencies", async () => {
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as foo from "foo";`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/foo/index.js": `import * as bar from "bar";`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/foo/node_modules/bar/index.js": `console.log("This is bar inside foo");`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/foo/node_modules/bar/package.json": "{}",
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["bar"]);

    await runWebpack(testConfig);
    expect(fs.existsSync(path.join(__dirname, "dist/node_modules/bar"))).to.be.true;
    expect(fs.readFileSync(path.join(__dirname, "dist/node_modules/bar/index.js"), "utf8")).to.equal(`console.log("This is bar inside foo");`);
  });

  it("should log when optional dependency is not installed ", async () => {
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/test.js": `try { require("foo"); } catch (err) {}`,
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["foo"]);

    const result = await runWebpack(testConfig);
    expect(fs.existsSync(path.join(__dirname, "dist/node_modules/foo"))).to.be.false;
    expect(result.logging.CopyExternalsPlugin.entries.length).to.be.equal(2);
    expect(result.warnings.length).to.be.equal(0);
  });

  it("should warn when non-optional dependency is not installed ", async () => {
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/test.js": `require("foo");`,
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["foo"]);

    const result = await runWebpack(testConfig);
    expect(fs.existsSync(path.join(__dirname, "dist/node_modules/foo"))).to.be.false;
    expect(result.logging.CopyExternalsPlugin.entries.length).to.be.equal(2);
    expect(result.warnings.length).to.be.equal(1);
    expect(result.warnings[0]).to.match(/Can't copy external package "foo" - it is not installed./);
  });

  afterEach(() => {
    vol.reset();
    clearFileSystem(__dirname);
    clearCache(__dirname);
  });
});
