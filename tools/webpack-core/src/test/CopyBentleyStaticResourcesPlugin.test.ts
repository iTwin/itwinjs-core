/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Volume } from "memfs";
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import { resetPaths, setApplicationDir } from "../utils/paths";
import { clearCache, clearFileSystem, fsFromJson, getTestConfig, runWebpack } from "./TestUtils";
import { CopyBentleyStaticResourcesPlugin } from "../plugins/CopyBentleyStaticResourcesPlugin";

describe("CopyBentleyStaticResourcesPlugin", () => {
  let testConfig: any;
  const vol = new Volume();

  before(() => {
    testConfig = getTestConfig("assets/copy-bentley-static-resources-plugin-test/test.js", [new CopyBentleyStaticResourcesPlugin(["assets"])]);
    vol.fromJSON({
      "lib/test/assets/copy-bentley-static-resources-plugin-test/test.js": "",
    });
    // memfs (vol) doesn't work if plugins being tested grab files from actual file system
    fsFromJson({
      "lib/test/assets/copy-bentley-static-resources-plugin-test/node_modules/@bentley/resource/lib/assets/staticResourcePlugin.js": `console.log("Fake resource");`,
    });
  });

  it("should be able to find directory path", async () => {
    setApplicationDir(path.join(__dirname, "assets/copy-bentley-static-resources-plugin-test"));

    const result = await runWebpack(testConfig, vol);

    const logging = result.logging;
    expect(logging, "Log message should not contain CopyBentleyStaticResourcesPlugin").to.not.have.property("CopyBentleyStaticResourcesPlugin");

    const testModulePath = path.join(__dirname, "dist/assets/staticResourcePlugin.js");
    expect(fs.existsSync(testModulePath), "staticResourcePlugin.js should be copied to /dist").to.be.true;
  });

  it("should not be able to find directory path", async () => {
    setApplicationDir(__dirname);

    const result = await runWebpack(testConfig, vol);

    const entry = result.logging.CopyBentleyStaticResourcesPlugin.entries[0];
    expect(entry.type, "Type should be an error").to.equal("error");
    expect(entry.message, `Message should start with Can't locate`).to.include(`Can't locate`);
  });

  afterEach(() => {
    resetPaths();
    clearFileSystem(__dirname);
    clearCache(__dirname);
  });
});
