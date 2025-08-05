/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
// const webpack = require("webpack");
const { globSync } = require("glob");

const frontendLib = path.resolve(__dirname, "../../../lib");

module.exports = [{
  // stats: "verbose",
  mode: "production",
  entry: globSync(
    path.resolve(frontendLib, "esm/test/worker/test-worker.js"),
    { windowsPathsNoEscape: true }
  ),
  output: {
    path: path.resolve(frontendLib, "test"),
    filename: "test-worker.js",
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
    nodeEnv: "production",
  },
}];

