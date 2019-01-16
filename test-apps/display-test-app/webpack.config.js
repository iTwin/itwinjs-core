/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const path = require("path");
const webpack = require("webpack");

const raw = process.env;
module.exports = {
  mode: "development",
  entry: { "main": path.resolve(__dirname, 'lib/frontend/SimpleViewTest.js'), },
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
  optimization: {
    // create only one runtime chunk.
    runtimeChunk: "single",
    moduleIds: "named",
  },
  node: {
    Buffer: false,
    fs: "empty",
    process: true
  },
  stats: "errors-only",
  externals: {
    electron: "require('electron')",
    '@bentley/bentleyjs-core': 'bentleyjs_core',
    '@bentley/geometry-core': 'geometry_core',
    '@bentley/imodeljs-i18n': 'imodeljs_i18n',
    '@bentley/imodeljs-clients': 'imodeljs_clients',
    '@bentley/imodeljs-common': 'imodeljs_common',
    '@bentley/imodeljs-frontend': 'imodeljs_frontend',
  },
};
