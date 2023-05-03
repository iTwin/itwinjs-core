/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
// const webpack = require("webpack");
const glob = require("glob");

const frontendLib = path.resolve(__dirname, "../../../lib");

function createConfig() {
  const config = {
    entry: glob.sync(path.resolve(frontendLib, "cjs/workers/example/example-worker.js")), // ###TODO esm?
    output: {
      path: path.resolve(frontendLib, "public/scripts/"),
        filename: "example-worker.js",
        devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
    },
    // devTool: "nosources-source-map",
    module: {
      rules: [
        {
          test: /\.js$/,
          use: "source-map-loader",
          enforce: "pre"
        },
      ],
    },
    stats: "errors-only",
    optimization: {
      nodeEnv: "production"
    },
    externals: {
      electron: "commonjs electron",
    },
  };

  return config;
}

module.exports = [
  createConfig(),
];
