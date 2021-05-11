/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const glob = require("glob");
const webpack = require("webpack");
module.exports = {
  mode: "development",
  entry: glob.sync(path.resolve(__dirname, "lib/**/*.test.js")),
  output: {
    path: path.resolve(__dirname, "lib/dist"),
    filename: "bundled-tests.js",
    devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]",
    libraryTarget: 'umd',
    globalObject: "this",
  },
  devtool: "nosources-source-map",
  module: {
    noParse: [
      // Don't parse draco_*_nodejs.js modules for `require` calls.  There are
      // requires for fs that cause it to fail even though the fs dependency
      // is not used.
      /draco_decoder_nodejs.js$/,
      /draco_encoder_nodejs.js$/
    ],
    rules: [
      {
        test: /\.js$/,
        use: "source-map-loader",
        enforce: "pre"
      },
      {
        test: /@azure[\/\\]storage-blob|azure-storage|AzureFileHandler|UrlFileHandler/,
        use: "null-loader"
      },
      {
        test: /websocket\.js$/,
        use: "null-loader"
      },
    ]
  },
  stats: "errors-only",
  optimization: {
    nodeEnv: "production"
  },
  resolve: {
    mainFields: ['module', 'main']
  },
  externals: {
    "electron": "commonjs electron",
    "fs": "fs",
    "process": "process",
    "child_process": "child_process",
  },
  node: {
    net: 'empty'
  },
  plugins: [
    // Makes some environment variables available to the JS code, for example:
    // if (process.env.NODE_ENV === "development") { ... }. See `./env.js`.
    new webpack.DefinePlugin({
      "global.GENTLY": false,
    })
  ]
};

