/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as HtmlWebpackPlugin from "html-webpack-plugin";
import * as webpack from "webpack";

const config: webpack.Configuration = {
  module: {
    rules: [
      {
        loader: "ts-loader",
        test: /\.tsx?$/,
      },
      {
        loader: "raw-loader",
        test: /\.md$/,
      },
      {
        loader: "url-loader?limit=100000",
        test: /\.(png|woff|woff2|eot|ttf|svg)$/,
      },
      {
        use: [
          { loader: "style-loader" },
          { loader: require.resolve("css-loader") },
        ],
        test: /\.s?css$/,
      },
      {
        loader: "tslint-loader",
        options: {
          emitErrors: true,
          failOnHint: true,
          configFile: path.resolve(__dirname, "tslint.json"),
        },
        test: /\.tsx?$/,
      },
      {
        loader: require.resolve("sass-loader"),
        options: {
          includePaths: [path.resolve(__dirname, "..", "node_modules")],
        },
        test: /\.scss$/,
      },
    ],
  },
  performance: {
    hints: false,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src", "index.html"),
    }),
  ],
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "../src/ui-ninezone/"),
    },
    extensions: [".ts", ".tsx", ".js"],
  },
};

export default config;
