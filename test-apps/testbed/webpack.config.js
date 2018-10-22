/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const glob = require("glob");
const webpack = require("webpack");
const raw = require("@bentley/config-loader/lib/IModelJsConfig").IModelJsConfig.init(true /*suppress error*/, true);
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
  plugins: [
    // Makes some environment variables available to the JS code, for example:
    // if (process.env.NODE_ENV === "development") { ... }. See `./env.js`.
    new webpack.DefinePlugin({
      "process.env": Object.keys(raw)
        .filter((key) => {
          return key.match(/^imjs_/i);
        })
        .reduce((env, key) => {
          env[key] = JSON.stringify(raw[key]);
          return env;
        }, {}),
    })
  ]
};

