/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const { globSync } = require("glob");

module.exports = {
  mode: "development",
  entry: [
    path.resolve(__dirname, "scripts/configureMocha.js"),
    ...globSync(path.resolve(__dirname, path.relative(__dirname, process.env.TESTS_GLOB))),
    path.resolve(__dirname, "scripts/runMocha.js")
  ],
  output: {
    path: path.resolve(__dirname, "../lib/ios/assets"),
    filename: "main.js",
    devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]",
    globalObject: "this",
  },
  target: "node",
  devtool: "source-map",
  resolve: {
    mainFields: ["main"],
    aliasFields: ["browser"],
    alias: { mocha$: "mocha/lib/mocha" }
  },
  module: {
    // don't parse @bentley/imodeljs-native/NativeLibrary.js,
    // we don't need to pull in the Native here as it gets loaded by the runtime
    // via (process as any)._linkedBinding("iModelJsNative")
    noParse: [/NativeLibrary.js$/],
    rules: [
      {
        test: /\.js$/,
        use: "source-map-loader",
        enforce: "pre"
      },
      {
        test: /growl\.js$/,
        use: 'null-loader'
      },
      {
        test: /xunit\.js$/,
        use: 'null-loader'
      },
      {
        test: /bunyan/,
        use: 'null-loader'
      }
    ]
  },
  node: {
    __filename: false,
    __dirname: false
  }
}