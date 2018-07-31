const path = require("path");

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
  }
};
