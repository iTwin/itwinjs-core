/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  devtool: 'inline-source-map',
  mode: 'production',
  entry: path.resolve(__dirname, 'src', 'Index.tsx'),
  target: 'web',
  output: {
    path: path.resolve(__dirname, '..', 'out', 'demo'),
    filename: 'demo.js'
  },
  plugins: [
    // Create HTML file that includes reference to bundled JS.
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src', 'index.html'),
      inject: true
    }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      "@src": path.resolve(__dirname, '../src/')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        enforce: 'pre',
        loader: 'tslint-loader',
        options: {
          emitErrors: true,
          failOnHint: true,
          tsConfigFile: path.resolve(__dirname, 'tsconfig.json'),
        }
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
      },
      {
        test: /\.md$/,
        loader: 'raw-loader'
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg)$/,
        loader: 'url-loader?limit=100000'
      },
      {
        test: /\.scss$/,
        use: {
          loader: require.resolve("sass-loader"),
          options: {
            includePaths: [path.resolve(__dirname, "..", "node_modules")]
          },
        },
        enforce: "pre",
      },
      {
        test: /\.s?css$/,
        use: [
          require.resolve("style-loader"),
          {
            loader: require.resolve("css-loader"),
            options: {
              importLoaders: 1,
            },
          },
        ]
      },

    ],
  },
}
