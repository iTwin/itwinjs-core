
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
// const webpack = require("webpack");
const glob = require("glob");

const frontendLib = path.resolve(__dirname, "../../../lib");

module.exports = [{
  // stats: "verbose",
  mode: "production",
  entry: glob.sync(path.resolve(frontendLib, "esm/workers/ImdlParser/Worker.js")),
  output: {
    path: path.resolve(frontendLib, "workers/webpack/"),
    filename: "parse-imdl-worker.js",
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
    ],
  },
  stats: "errors-only",
  optimization: {
    nodeEnv: "production"
  },
}];
