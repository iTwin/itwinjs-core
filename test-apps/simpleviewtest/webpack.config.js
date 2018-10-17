/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const webpack = require("webpack");
const configLoader = require("@bentley/config-loader/lib/IModelJsConfig")
const configEnv = configLoader.IModelJsConfig.init(true /*suppress error*/, true /* suppress message */);
if (configEnv) {
  Object.assign(process.env, configEnv);
} else {
  console.error("Webpack failed to locate iModelJs configuration");
}


const raw = process.env;
module.exports = {
  mode: "development",
  entry: "./lib/frontend/SimpleViewTest.js",
  output: {
    path: path.resolve(__dirname, "./lib/backend/public"),
    filename: '[name].bundle.js',
    devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
  },
  devtool: "cheap-module-source-map",
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "source-map-loader",
        enforce: "pre"
      }
    ]
  },
  stats: "errors-only",
  externals: {
    electron: "require('electron')"
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": Object.keys(raw).filter(v => v.match(/^imjs_/i)).reduce((env, key) => {
        env[key] = JSON.stringify(raw[key]);
        return env;
      }, {})
    })
  ]
};
