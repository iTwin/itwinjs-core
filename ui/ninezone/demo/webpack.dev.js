/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const path = require('path');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  devServer: {
    open: true
  },
  devtool: 'inline-source-map',
  entry: {
    entry: path.resolve(__dirname, 'src', 'App.tsx')
  },
  mode: 'development',
  output: {
    filename: 'demo.js',
    path: path.resolve(__dirname, '..', 'lib', 'demo')
  }
});
