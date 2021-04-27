/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
// import { ExternalsPlugin } from "webpack";
// import { handlePrefixedExternals } from "../plugins/RequireMagicCommentsPlugin";
// import {ExternalsPlugin} from "./webpack/lib/ExternalsPlugin";
// const ExternalsPlugin = require("webpack/lib/ExternalsPlugin");

export function createCompiler(webpack: any, config: any) {
  let compiler: any;
  try {
    compiler = webpack(config);
  } catch (err) {
    console.log(err);
  }
  return compiler;
}

export function getTestConfig(srcFile: any, pluginToTest: any) {
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
    externals: [
      "fs-extra",
      "electron",
      "eslint",
      "@bentley/imodeljs-native",
    ],
  };
}
