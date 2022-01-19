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
import { addCopyFilesSuffix, addExternalPrefix, copyFilesRule, handlePrefixedExternals, RequireMagicCommentsPlugin } from "../plugins/RequireMagicCommentsPlugin";
import { ExternalsPlugin } from "webpack";
import { setApplicationDir } from "../utils/paths";

describe("RequireMagicCommentsPlugin", () => {
  let testConfig: any;
  const vol = new Volume();

  before(() => {
    setApplicationDir(path.join(__dirname, "assets/require-magic-comments-plugin-test"));
  });

  it("should transform requires with comment via custom handler", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require(/*test*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/node_modules/bar/index.js": `console.log("Module bar");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /test/i, handler: () => "bar" }])];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);

    const result = await runWebpack(testConfig, vol);
    expect(result.logging.RequireMagicCommentsPlugin.entries[0].message).to.include(`Handler for /*test*/ - transformed "foo" => "bar"`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8")).to.matchSnapshot();
  });

  it("should work with external comments and addExternalPrefix handler", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require(/*webpack: external*/"foo");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *external/i, handler: addExternalPrefix }]), new ExternalsPlugin("commonjs", handlePrefixedExternals)];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);

    const result = await runWebpack(testConfig, vol);
    expect(result.logging.RequireMagicCommentsPlugin.entries[0].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "BeWebpack-EXTERNAL:foo"`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8")).to.matchSnapshot();
  });

  it("should work with external comments and resolve not converted", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*test*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/node_modules/bar/index.js": `console.log("Module bar");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /test/i, handler: () => "bar" }])];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);

    const result = await runWebpack(testConfig, vol);
    expect(result.logging.RequireMagicCommentsPlugin.entries[0].message).to.include(`Handler for /*test*/ - transformed "foo" => "bar"`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8")).to.matchSnapshot();
  });

  it("should work with external comments and resolve converted", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*test*/"foo");`,
      "lib/test/assets/require-magic-comments-plugin-test/node_modules/bar/index.js": `console.log("Module bar");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /test/i, handler: () => "bar", convertResolve: true }])];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);

    const result = await runWebpack(testConfig, vol);
    expect(result.logging.RequireMagicCommentsPlugin.entries[0].message).to.include(`Converting require.resolve => require for "foo"`);
    expect(result.logging.RequireMagicCommentsPlugin.entries[1].message).to.include(`Handler for /*test*/ - transformed "foo" => "bar"`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8")).to.matchSnapshot();
  });

  it("should work with external comments with resolve not converted and addExternalPrefix handler", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*webpack: external*/"foo");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *external/i, handler: addExternalPrefix }]), new ExternalsPlugin("commonjs", handlePrefixedExternals)];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);

    const result = await runWebpack(testConfig, vol);
    expect(result.logging.RequireMagicCommentsPlugin.entries[0].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "BeWebpack-EXTERNAL:foo"`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8")).to.matchSnapshot();
  });

  it("should work with external comments with resolve converted and addExternalPrefix handler", async () => {
    vol.fromJSON({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*webpack: external*/"foo");`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *external/i, handler: addExternalPrefix, convertResolve: true }]), new ExternalsPlugin("commonjs", handlePrefixedExternals)];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest);

    const result = await runWebpack(testConfig, vol);
    expect(result.logging.RequireMagicCommentsPlugin.entries[0].message).to.include(`Converting require.resolve => require for "foo"`);
    expect(result.logging.RequireMagicCommentsPlugin.entries[1].message).to.include(`Handler for /*webpack: external*/ - transformed "foo" => "BeWebpack-EXTERNAL:foo"`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8")).to.matchSnapshot();
  });

  it("should work with copyfile comments and addCopyFileSuffix handler", async () => {
    fsFromJson({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require(/*webpack: copyfile*/"./bar.txt");`,
      "lib/test/assets/require-magic-comments-plugin-test/bar.txt": `This is bar.txt`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *copyfile/i, handler: addCopyFilesSuffix }])];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest, undefined, [copyFilesRule]);

    const result = await runWebpack(testConfig);
    expect(result.logging.RequireMagicCommentsPlugin.entries[0].message).to.include(`Handler for /*webpack: copyfile*/ - transformed "./bar.txt" => "./bar.txt?BeWebpack-COPYFILE}"`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8").split(`\* 3 \*`)[0]).to.matchSnapshot();
    expect(fs.readFileSync(path.join(__dirname, "dist/static/bar.91b123.txt"), "utf8")).to.equal("This is bar.txt");
  });

  it("should work with copyfile comments, addCopyFileSuffix, and resolve converted", async () => {
    fsFromJson({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*webpack: copyfile*/"./bar.txt");`,
      "lib/test/assets/require-magic-comments-plugin-test/bar.txt": `This is bar.txt`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *copyfile/i, handler: addCopyFilesSuffix, convertResolve: true }])];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest, undefined, [copyFilesRule]);

    const result = await runWebpack(testConfig);
    expect(result.logging.RequireMagicCommentsPlugin.entries[0].message).to.include(`Converting require.resolve => require for "./bar.txt"`);
    expect(result.logging.RequireMagicCommentsPlugin.entries[1].message).to.include(`Handler for /*webpack: copyfile*/ - transformed "./bar.txt" => "./bar.txt?BeWebpack-COPYFILE}"`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8").split(`\* 3 \*`)[0]).to.matchSnapshot();
    expect(fs.readFileSync(path.join(__dirname, "dist/static/bar.91b123.txt"), "utf8")).to.equal("This is bar.txt");
  });

  it("should work with copyfile comments, addCopyFileSuffix, and resolve not converted", async () => {
    fsFromJson({
      "lib/test/assets/require-magic-comments-plugin-test/test.js": `require.resolve(/*webpack: copyfile*/"./bar.txt");`,
      "lib/test/assets/require-magic-comments-plugin-test/bar.txt": `This is bar.txt`,
    });
    const pluginsToTest = [new RequireMagicCommentsPlugin([{ test: /webpack: *copyfile/i, handler: addCopyFilesSuffix }])];
    testConfig = getTestConfig("assets/require-magic-comments-plugin-test/test.js", pluginsToTest, undefined, [copyFilesRule]);

    const result = await runWebpack(testConfig);
    expect(result.logging.RequireMagicCommentsPlugin.entries[0].message).to.include(`Handler for /*webpack: copyfile*/ - transformed "./bar.txt" => "./bar.txt?BeWebpack-COPYFILE}"`);
    expect(fs.readFileSync(path.join(__dirname, "dist/test.js"), "utf8").split(`\* 3 \*`)[0]).to.matchSnapshot();
    expect(fs.readFileSync(path.join(__dirname, "dist/static/bar.91b123.txt"), "utf8")).to.equal("This is bar.txt");
  });

  afterEach(() => {
    vol.reset();
    clearFileSystem(__dirname);
    clearCache(__dirname);
  });
});
