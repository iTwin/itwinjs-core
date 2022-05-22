/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";

const path = require("path");
const CaseSensitivePathsPlugin = require("case-sensitive-paths-webpack-plugin");
const { BackendDefaultsPlugin } = require("@itwin/core-webpack-tools");

function getWebpackConfig(srcFile, outDir, profile) {
  return {
    mode: process.env.NODE_ENV,
    // These are the "entry points" to our application.
    // This means they will be the "root" imports that are included in JS bundle.
    entry: [
      srcFile
    ],
    output: {
      libraryTarget: "commonjs2",
      // The build folder.
      // Next line is not used in dev but WebpackDevServer crashes without it:
      path: outDir,
      // The name of the output bundle.
      filename: path.basename(srcFile),
      // There are also additional JS chunk files if you use code splitting.
      chunkFilename: "[name].chunk.js",
    },
    target: "electron-main",
    devtool: "source-map",
    plugins: [
      new BackendDefaultsPlugin(),
      // Watcher doesn't work well if you mistype casing in a path so we use
      // a plugin that prints an error when you attempt to do this.
      // See https://github.com/facebook/create-react-app/issues/240
      new CaseSensitivePathsPlugin(),
    ],
    profile,
    node: {
      __dirname: false,
      __filename: false,
    }
  };
};

module.exports = {
  getWebpackConfig,
}