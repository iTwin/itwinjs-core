/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as merge from "webpack-merge";
import "webpack-dev-server";
import commonConfig from "./webpack.common";

const config = merge(commonConfig, {
  devServer: {
    open: true,
  },
  mode: "development",
  devtool: "inline-source-map",
  entry: {
    entry: path.resolve(__dirname, "src", "App.tsx"),
  },
  output: {
    filename: "demo.js",
    path: path.resolve(__dirname, "..", "lib", "demo"),
  },
});

export default config;
