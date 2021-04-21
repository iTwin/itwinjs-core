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
      path.join(__dirname, srcFile)
    ],
    output: {
      path: path.join(__dirname, 'dist'),
      filename: path.basename(srcFile),
    },
    plugins: [
      pluginToTest,
    ],
  };
};

function createCompiler(webpack: any, config: any) {
  let compiler: any;
  try {
    compiler = webpack(config);
  } catch (err) {
    console.log(err);
  }
  return compiler;
}

describe("CopyBentleyStaticResourcesPlugin", () => {
  let testConfig: any;
  let testCompiler: any;

  before(() => {
    updatePaths(__dirname);
    testConfig = getTestConfig("assets/empty-test/empty.js", new CopyBentleyStaticResourcesPlugin([""]))
    testCompiler = createCompiler(webpack, testConfig);
  });

  it("failure with inability to find directory path", async () => {
    const stats = await new Promise<any>((resolve, reject) => {
      testCompiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats))
    });

    const entry = stats.toJson({ logging: true }).logging.CopyBentleyStaticResourcesPlugin.entries[0];

    expect(entry.type, 'Type is not an error').to.equal('error');
    expect(entry.message, `Message should start with Can't locate`).to.include(`Can't locate`);
  })
})
