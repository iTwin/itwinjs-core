/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Volume } from "memfs";
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import { ufs } from "unionfs";
import { clearCache, clearFileSystem, fsFromJson, getTestConfig, runWebpack } from "./TestUtils";
import { CopyExternalsPlugin } from "../plugins/CopyExternalsPlugin";
import { resetPaths, setApplicationDir } from "../utils/paths";

describe("CopyExternalsPlugin", () => {
  let testConfig: any;
  const vol = new Volume();

  beforeEach(() => {
    setApplicationDir(path.join(__dirname, "assets/copy-externals-plugin-test"));
    ufs
      .use(vol as any)
      .use(fs as any);
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/package.json": `{"dependencies": {"fs-extra": "^8.1.0"}}`,
    });
  });

  it("skips electron", async () => {
    vol.fromJSON({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as electron from "electron";`,
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["electron"]);
    const result = await runWebpack(testConfig, ufs);

    const logging = result.logging;
    expect(logging, "Log message should not contain CopyExternalsPlugin").to.not.have.property("CopyExternalsPlugin");
  });

  it("should copy direct externals dependency", async () => {
    vol.fromJSON({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as fs from "fs-extra";`,
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["fs-extra"]);
    const result = await runWebpack(testConfig, ufs);

    const logging = result.logging.CopyExternalsPlugin.entries;
    expect(logging.length, "Length of entries should be 4").to.be.equal(4);

    const modules = ["fs-extra", "graceful-fs", "jsonfile", "universalify"];
    for (let i = 0; i < 4; i++) {
      expect(logging[i].type).to.be.equal("log");
      const regex = new RegExp(`^Copying.*?${modules[i]}.*?$`);
      expect(logging[i].message, `Message should contain 'Copying ... ${modules[i]}'`).to.match(regex);
    }

    const testModulePath = path.join(__dirname, "dist/node_modules/fs-extra");
    expect(fs.existsSync(testModulePath), "fs-extra should be copied to /dist/node_modules").to.be.true;
  });

  it("should copy @bentley/imodeljs-native", async () => {
    vol.fromJSON({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as imodeljsnative from "@bentley/imodeljs-native";`,
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["@bentley/imodeljs-native"]);
    const result = await runWebpack(testConfig, ufs);

    const logging = result.logging.CopyExternalsPlugin.entries;
    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message, "Message should contain 'Copying ... imodeljs-native'").to.match(/^Copying.*?imodeljs-native.*?$/);

    const testModulePath = path.join(__dirname, "dist/node_modules/@bentley/imodeljs-native");
    expect(fs.existsSync(testModulePath), "@bentley/imodeljs-native should be copied to /dist/node_modules").to.be.true;
  });

  it("should copy indirect dependencies with symlink", async () => {
    vol.fromJSON({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as a from "a";`,
    });
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/node_modules/a/package.json": `{"dependencies": {"b": ""}}`,
      "lib/test/assets/copy-externals-plugin-test/bar/node_modules/b/package.json": `{"name": "b", "dependencies": {"c": ""}}`,
      "lib/test/assets/copy-externals-plugin-test/bar/node_modules/c/package.json": `{"name": "c"}`,
    });
    fs.symlinkSync("../bar/node_modules/b", "lib/test/assets/copy-externals-plugin-test/node_modules/b", "junction");
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["a"]);
    const result = await runWebpack(testConfig, ufs);

    const logging = result.logging.CopyExternalsPlugin.entries;
    expect(logging.length, "Length of entries should be 3").to.be.equal(3);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.be.equal("Copying lib\\test\\assets\\copy-externals-plugin-test\\node_modules\\a to lib\\test\\dist\\node_modules");
    expect(logging[1].type).to.be.equal("log");
    expect(logging[1].message).to.be.include("Copying lib\\test\\assets\\copy-externals-plugin-test\\bar\\node_modules\\b to lib\\test\\dist\\node_modules");
    expect(logging[2].type).to.be.equal("log");
    expect(logging[2].message).to.be.include("Copying lib\\test\\assets\\copy-externals-plugin-test\\bar\\node_modules\\c to lib\\test\\dist\\node_modules");

    const testModulePath = path.join(__dirname, "/dist/node_modules");
    expect(fs.existsSync(path.join(testModulePath, "/a"))).to.be.true;
    expect(fs.existsSync(path.join(testModulePath, "/b"))).to.be.true;
    expect(fs.existsSync(path.join(testModulePath, "/c"))).to.be.true;
  });

  it("should copy indirect dependency which is not nested", async () => {
    vol.fromJSON({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as foo from "foo";`,
    });
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/node_modules/foo/index.js": `import * as bar from "bar";`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/bar/index.js": `console.log("This is bar");`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/bar/package.json": "{}",
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["bar"]);
    const result = await runWebpack(testConfig, ufs);

    const logging = result.logging.CopyExternalsPlugin.entries;
    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.be.equal(`Copying lib\\test\\assets\\copy-externals-plugin-test\\node_modules\\bar to lib\\test\\dist\\node_modules`);

    const testModulePath = path.join(__dirname, "dist/node_modules/bar/index.js");
    expect(fs.existsSync(testModulePath)).to.be.true;
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`console.log("This is bar");`);
  });

  it("should copy indirect dependences which are nested", async () => {
    vol.fromJSON({
      "lib/test/assets/copy-externals-plugin-test/test.js": `import * as foo from "foo";`,
    });
    fsFromJson({
      "lib/test/assets/copy-externals-plugin-test/node_modules/foo/index.js": `import * as bar from "bar";`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/foo/node_modules/bar/index.js": `console.log("This is bar inside foo");`,
      "lib/test/assets/copy-externals-plugin-test/node_modules/foo/node_modules/bar/package.json": "{}",
    });
    testConfig = getTestConfig("assets/copy-externals-plugin-test/test.js", [new CopyExternalsPlugin()], ["bar"]);
    const result = await runWebpack(testConfig, ufs);

    const logging = result.logging.CopyExternalsPlugin.entries;
    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message).to.be.equal(`Copying lib\\test\\assets\\copy-externals-plugin-test\\node_modules\\foo\\node_modules\\bar to lib\\test\\dist\\node_modules`);

    const testModulePath = path.join(__dirname, "dist/node_modules/bar/index.js");
    expect(fs.existsSync(testModulePath)).to.be.true;
    const testModuleContent = fs.readFileSync(testModulePath, "utf8");
    expect(testModuleContent).to.be.equal(`console.log("This is bar inside foo");`);
  });

  afterEach(() => {
    resetPaths();
    vol.reset();
    clearFileSystem(__dirname);
    clearCache(__dirname);
  });
});
