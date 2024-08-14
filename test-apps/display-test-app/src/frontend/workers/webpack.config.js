/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const { globSync } = require("glob");

const frontendLib = path.resolve(__dirname, "../../../lib");

module.exports = [{
  stats: "verbose",
  mode: "development",
  //mode: "production",
  entry: globSync(
    path.resolve(frontendLib, "workers/ExampleWorker.js"),
    { windowsPathsNoEscape: true }
  ),
  output: {
    path: path.resolve(frontendLib, "workers/webpack/"),
    filename: "ExampleWorker.js",
    devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "source-map-loader",
        sideEffects: false,
        enforce: "pre"
      },
      {
        test: /@itwin/,
        sideEffects: false,
      },
      {
        test: /core-geometry/,
        // Enable side effects for core-geometry.
        // Otherwise, Path and Loop which both extend CurveChain get defined before CurveChain is defined.
        sideEffects: true,
      }
    ],
  },
  stats: "errors-only",
  optimization: {
    nodeEnv: "production"
  },
}];
