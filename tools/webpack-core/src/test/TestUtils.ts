/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { copyFilesRule } from "../plugins/RequireMagicCommentsPlugin";

export function createTestCompiler(webpack: any, config: any, vol: any) {
  let compiler: any;
  try {
    compiler = webpack(config);
  } catch (err) {
    console.log(err);
  }
  compiler.inputFileSystem = vol;
  return compiler;
}

export function getTestConfig(srcFile: any, pluginToTest: any) {
  return {
    entry: [
      path.join(__dirname, srcFile),
    ],
    output: {
      path: path.join(__dirname, "dist"),
      chunkFilename: path.basename(srcFile),
      filename: "runtime.js",
      pathinfo: false,
    },
    plugins: [
      pluginToTest,
    ],
    externals: [
      "fs-extra",
      "electron",
      "eslint",
      "@bentley/imodeljs-native",
    ],
    optimization: { minimize: false, runtimeChunk: true },
  };
}

export function getRequireExternalConfig(srcFile: any, pluginToTest: any) {
  return {
    entry: [
      path.join(__dirname, srcFile),
    ],
    output: {
      path: path.join(__dirname, "dist"),
      chunkFilename: path.basename(srcFile),
      filename: "runtime.js",
      pathinfo: false,
    },
    plugins: pluginToTest,
    externals: [
      "fs-extra",
      "electron",
      "eslint",
      "@bentley/imodeljs-native",
    ],
    optimization: { minimize: false, runtimeChunk: true },
    module: {
      rules: [copyFilesRule],
    }
  };
}

export function getRequireCopyConfig(srcFile: any, pluginToTest: any) {
  return {
    entry: [
      path.join(__dirname, srcFile),
    ],
    output: {
      path: path.join(__dirname, "dist"),
      chunkFilename: path.basename(srcFile),
      filename: "runtime.js",
      pathinfo: false,
    },
    plugins: pluginToTest,
    optimization: { minimize: false, runtimeChunk: true },
    module: {
      rules: [copyFilesRule],
    }
  };
}
