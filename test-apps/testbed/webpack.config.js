/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const glob = require("glob");

module.exports = {
  mode: "development",
  entry: glob.sync(path.resolve(__dirname, "lib/frontend**/*.test.js")),
  output: {
    path: path.resolve(__dirname, "lib/dist"),
    filename: "testbed.js",
    devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
  },
  devtool: "nosources-source-map",
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "source-map-loader",
        enforce: "pre"
      },
      {
        test: /azure-storage|AzureFileHandler|UrlFileHandler/,
        use: "null-loader"
      }
    ]
  },
  stats: "errors-only",
  optimization: {
    nodeEnv: "production"
  },
};

