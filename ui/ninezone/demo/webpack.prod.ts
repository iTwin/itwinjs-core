/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as merge from "webpack-merge";
import commonConfig from "./webpack.common";

const config = merge(commonConfig, {
  entry: path.resolve(__dirname, "src", "Index.tsx"),
  mode: "production",
  output: {
    filename: "demo.js",
    path: path.resolve(__dirname, "..", "..", "..", "generated-docs", "ui", "assets", "ui-ninezone"),
  },
});

export default config;
