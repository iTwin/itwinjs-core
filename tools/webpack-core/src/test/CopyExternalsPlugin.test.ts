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
import { CopyExternalsPlugin } from "../plugins/CopyExternalsPlugin";

describe("CopyExternalsPlugin", () => {
  let testConfig: any;
  let testCompiler: any;
  const vol = new Volume();

  before(() => {
    vol.fromJSON({
      "lib/test/assets/copy-externals-plugin-test/copyElectronTest.js": `import * as electron from "electron";`,
      "lib/test/assets/copy-externals-plugin-test/copyEslintTest.js": `import * as eslint from "eslint";`,
      "lib/test/assets/copy-externals-plugin-test/copyFsExtraTest.js": `import * as fs from "fs-extra";`,
      "lib/test/assets/copy-externals-plugin-test/copyImodeljsNativeTest.js": `import * as imodeljsnative from "@bentley/imodeljs-native";`,
    });
  });

  it("success copying direct externals dependency", async () => {
    testConfig = getTestConfig("assets/copy-externals-plugin-test/copyFsExtraTest.js", new CopyExternalsPlugin());
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.CopyExternalsPlugin.entries;
    expect(logging.length, "Length of entries should be 4").to.be.equal(4);
    for (let i = 0; i < 4; i++) {
      expect(logging[i].type).to.be.equal("log");
      expect(logging[i].message, "Message should contain 'Copying ... fs-extra'").to.match(/^Copying.*?fs-extra.*?$/);
    }

    const testModulePath = path.join(__dirname, "dist/node_modules/fs-extra");
    expect(fs.existsSync(testModulePath), "fs-extra should be copied to /dist/node_modules").to.be.true;
  });

  it("sucess not copying indirect depency", async () => {
    testConfig = getTestConfig("assets/copy-externals-plugin-test/copyEslintTest.js", new CopyExternalsPlugin());
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.CopyExternalsPlugin.entries;
    expect(logging.length, "Length of entries should be 2").to.be.equal(2);
    expect(logging[0].type).to.be.equal("warn");
    expect(logging[0].message).to.be.equal(`Can't copy package "eslint" - it is not a direct dependency.`);
    expect(logging[1].type).to.be.equal("log");
    expect(logging[1].message).to.be.include(`"eslint" included at lib\\test\\assets\\copy-externals-plugin-test\\copyEslintTest.js`);
  });

  it("success skipping electorn", async () => {
    testConfig = getTestConfig("assets/copy-externals-plugin-test/copyElectronTest.js", new CopyExternalsPlugin());
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.CopyExternalsPlugin.entries;
    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message, "Message should contain 'Skipping electron'").to.equal("Skipping electron");
  });

  it("success copying @bentley/imodeljs-native", async () => {
    testConfig = getTestConfig("assets/copy-externals-plugin-test/copyImodeljsNativeTest.js", new CopyExternalsPlugin());
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging.CopyExternalsPlugin.entries;
    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message, "Message should contain 'Copying ... imodeljs-native'").to.match(/^Copying.*?imodeljs-native.*?$/);

    const testModulePath = path.join(__dirname, "dist/node_modules/@bentley/imodeljs-native");
    expect(fs.existsSync(testModulePath), "@bentley/imodeljs-native should be copied to /dist/node_modules").to.be.true;
  });
});
