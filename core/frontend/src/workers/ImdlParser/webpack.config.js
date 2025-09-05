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
    path.resolve(frontendLib, "esm/workers/ImdlParser/Worker.js"),
    { windowsPathsNoEscape: true }
  ),
  output: {
    path: path.resolve(frontendLib, "workers/webpack/"),
    filename: "parse-imdl-worker.js",
    devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]",
  },
  // add a fallback for fs and path to prevent Webpack from trying to polyfill them
  // This is necessary because these modules are not available in the browser environment but draco3d in theory uses them in non-browser cases which we are not exercising
  resolve: {
    fallback: {
      fs: false, // Set 'fs' to false to prevent Webpack from trying to polyfill it
      path: false, // Set 'path' to false to prevent Webpack from trying to polyfill it
    }
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
    ],
  },
  stats: "errors-only",
  optimization: {
    nodeEnv: "production"
  },
}];
