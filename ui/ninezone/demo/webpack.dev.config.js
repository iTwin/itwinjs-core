/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const baseConfig = require('./webpack.config');

const config = {
  ...baseConfig,
  mode: 'development',
  devServer: {
    contentBase: path.join(__dirname, "lib"),
    port: 7777,
    open: true,
    historyApiFallback: true,
  },
};

module.exports = config;
