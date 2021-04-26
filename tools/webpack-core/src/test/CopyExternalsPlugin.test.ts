/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import * as webpack from "webpack";
import * as fs from "fs-extra";
import { updatePaths, resetPaths } from "../utils/paths";
import { createCompiler, getTestConfig } from "./TestUtils";
import { CopyExternalsPlugin } from "../plugins/CopyExternalsPlugin";

describe("CopyExternalsPlugin", () => {
  let testConfig: any;
  let testCompiler: any;

  it("success copying direct externals dependency", async () => {
    testConfig = getTestConfig("assets/copy-externals-plugins-test/copyFsExtraTest.js", new CopyExternalsPlugin());
    testCompiler = createCompiler(webpack, testConfig);
    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging["CopyExternalsPlugin"].entries;

    expect(logging.length, "Length of entries should be 4").to.be.equal(4);
    for (let i = 0; i < 4; i++) {
      expect(logging[i].type).to.be.equal("log");
      expect(logging[i].message, "Message should contain 'Copying ... fs-extra'").to.match(/^Copying.*?fs-extra.*?$/);
    }
  });

  it("sucess not copying indirect depency", async () => {
    testConfig = getTestConfig("assets/copy-externals-plugins-test/copyEslintTest.js", new CopyExternalsPlugin());
    testCompiler = createCompiler(webpack, testConfig);
    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging["CopyExternalsPlugin"].entries;

    expect(logging.length, "Length of entries should be 2").to.be.equal(2);
    expect(logging[0].type).to.be.equal("warn");
    expect(logging[0].message).to.be.equal(`Can't copy package "eslint" - it is not a direct dependency.`);
    expect(logging[1].type).to.be.equal("log");
    expect(logging[1].message).to.be.include(`"eslint" included at lib\\test\\assets\\copy-externals-plugins-test\\copyEslintTest.js`);
  });

  it("success skipping electorn", async () => {
    testConfig = getTestConfig("assets/copy-externals-plugins-test/copyElectronTest.js", new CopyExternalsPlugin());
    testCompiler = createCompiler(webpack, testConfig);
    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging["CopyExternalsPlugin"].entries;

    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message, "Message should contain 'Skipping electron'").to.equal("Skipping electron");
  });

  it("success copying @bentley/imodeljs-native", async () => {
    testConfig = getTestConfig("assets/copy-externals-plugins-test/copyImodeljsNativeTest.js", new CopyExternalsPlugin());
    testCompiler = createCompiler(webpack, testConfig);
    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging["CopyExternalsPlugin"].entries;

    expect(logging.length, "Length of entries should be 1").to.be.equal(1);
    expect(logging[0].type).to.be.equal("log");
    expect(logging[0].message, "Message should contain 'Copying ... imodeljs-native'").to.match(/^Copying.*?imodeljs-native.*?$/);
  });

  afterEach(() => {
    resetPaths();
  });
});