/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Volume } from "memfs";
import { expect } from "chai";
import * as path from "path";
import * as webpack from "webpack";
import * as fs from "fs-extra";
import { resetPaths, updatePaths } from "../utils/paths";
import { createTestCompiler, getTestConfig } from "./TestUtils";
import { CopyBentleyStaticResourcesPlugin } from "../plugins/CopyBentleyStaticResourcesPlugin";

describe("CopyBentleyStaticResourcesPlugin", () => {
  let testConfig: any;
  let testCompiler: any;
  const vol = new Volume();

  before(() => {
    vol.fromJSON({
      "lib/test/assets/copy-bentley-static-resources-plugin-test/copyStaticResourceSucessTest.js": "",
      "lib/test/assets/copy-bentley-static-resources-plugin-test/copyStaticResourceFailedTest.js": "",
    });
    fs.mkdirSync("lib/test/assets/copy-bentley-static-resources-plugin-test/node_modules/@bentley/resource/lib/assets/", { recursive: true });
    fs.writeFileSync("lib/test/assets/copy-bentley-static-resources-plugin-test/node_modules/@bentley/resource/lib/assets/staticResourcePlugin.js", `console.log("Fake resource");`);
  });

  it("success with ability to find directory path", async () => {
    updatePaths(path.join(__dirname, "assets/copy-bentley-static-resources-plugin-test"));
    testConfig = getTestConfig("assets/copy-bentley-static-resources-plugin-test/copyStaticResourceSucessTest.js", new CopyBentleyStaticResourcesPlugin(["assets"]));
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging;
    expect(logging, "Log message should not contain CopyBentleyStaticResourcesPlugin").to.not.have.property("CopyBentleyStaticResourcesPlugin");

    const testModulePath = path.join(__dirname, "dist/assets/staticResourcePlugin.js");
    expect(fs.existsSync(testModulePath), "staticResourcePlugin.js should be copied to /dist").to.be.true;
  });

  it("failure with inability to find directory path", async () => {
    updatePaths(__dirname);
    testConfig = getTestConfig("assets/copy-bentley-static-resources-plugin-test/copyStaticResourceFailedTest.js", new CopyBentleyStaticResourcesPlugin(["assets"]));
    testCompiler = createTestCompiler(webpack, testConfig, vol);

    const result = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const entry = result.toJson({ logging: true }).logging.CopyBentleyStaticResourcesPlugin.entries[0];
    expect(entry.type, "Type should be an error").to.equal("error");
    expect(entry.message, `Message should start with Can't locate`).to.include(`Can't locate`);
  });

  afterEach(() => {
    resetPaths();
  });
});
