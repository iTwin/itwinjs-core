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
