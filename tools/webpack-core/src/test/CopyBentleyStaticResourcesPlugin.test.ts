/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
import { Volume } from "memfs";
import * as path from "path";
import * as fs from "fs-extra";
import { resetPaths, setApplicationDir } from "../utils/paths";
import { clearCache, clearFileSystem, fsFromJson, getTestConfig, runWebpack } from "./TestUtils";
import { CopyBentleyStaticResourcesPlugin } from "../plugins/CopyBentleyStaticResourcesPlugin";
import { expect } from "chai";

describe("CopyBentleyStaticResourcesPlugin", () => {
  let testConfig: any;
  const vol = new Volume();

  beforeEach(() => {
    testConfig = getTestConfig("assets/copy-bentley-static-resources-plugin-test/test.js", [new CopyBentleyStaticResourcesPlugin(["assets"])]); // eslint-disable-line deprecation/deprecation
    vol.fromJSON({
      "lib/test/assets/copy-bentley-static-resources-plugin-test/test.js": "",
    });
    // memfs (vol) doesn't work if plugins being tested grab files from actual file system
    fsFromJson({
      "lib/test/assets/copy-bentley-static-resources-plugin-test/node_modules/@bentley/resource/lib/assets/staticResourcePlugin.js": `console.log("Fake resource");`,
    });
  });

  it("should find and copy assets directories from packages in node_modules/@bentley", async () => {
    setApplicationDir(path.join(__dirname, "assets/copy-bentley-static-resources-plugin-test"));
    const result = await runWebpack(testConfig, vol);
    expect(result.logging).to.not.have.property("CopyBentleyStaticResourcesPlugin");
    expect(fs.readFileSync(path.join(__dirname, "dist/assets/staticResourcePlugin.js"), "utf8")).to.equal(`console.log("Fake resource");`);
  });

  afterEach(() => {
    resetPaths();
    vol.reset();
    clearFileSystem(__dirname);
    clearCache(__dirname);
  });
});
