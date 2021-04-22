/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as path from "path";
import * as webpack from "webpack";
import { updatePaths } from "../utils/paths";
import { CopyBentleyStaticResourcesPlugin } from "../plugins/CopyBentleyStaticResourcesPlugin";

function getTestConfig(srcFile: any, pluginToTest: any) {
  return {
    entry: [
      path.join(__dirname, srcFile),
    ],
    output: {
      path: path.join(__dirname, "dist"),
      filename: path.basename(srcFile),
    },
    plugins: [
      pluginToTest,
    ],
  };
}

function createCompiler(webpackTest: any, config: any) {
  let compiler: any;
  try {
    compiler = webpackTest(config);
  } catch (err) {
    console.log(err);
  }
  return compiler;
}

describe("CopyBentleyStaticResourcesPlugin", () => {
  // let testConfig: any;
  // let testCompiler: any;

  // before(() => {
  //   testConfig = getTestConfig("assets/empty-test/empty.js", new CopyBentleyStaticResourcesPlugin([""]));
  //   testCompiler = createCompiler(webpack, testConfig);
  // });

  it("success with inability to find directory path", async () => {
    // console.log(path.join(__dirname, "assets/copy-resources-test"));
    // updatePaths(path.join(__dirname, "assets/copy-resources-test"));
    const successTestConfig = getTestConfig("assets/copy-resources-test/copyResources.js", new CopyBentleyStaticResourcesPlugin([""]));
    const sucessTestCompiler = createCompiler(webpack, successTestConfig);
    const result = await new Promise<any>((resolve, reject) => {
      sucessTestCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const logging = result.toJson({ logging: true }).logging;

    expect(logging).to.not.have.property("CopyBentleyStaticResourcesPlugin");
  });

  it("failure with inability to find directory path", async () => {
    updatePaths(__dirname);
    const failTestConfig = getTestConfig("assets/empty-test/empty.js", new CopyBentleyStaticResourcesPlugin([""]));
    const failTestCompiler = createCompiler(webpack, failTestConfig);
    const result = await new Promise<any>((resolve, reject) => {
      failTestCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats));
    });

    const entry = result.toJson({ logging: true }).logging.CopyBentleyStaticResourcesPlugin.entries[0];

    expect(entry.type, "Type is not an error").to.equal("error");
    expect(entry.message, `Message should start with Can't locate`).to.include(`Can't locate`);
  });
});
