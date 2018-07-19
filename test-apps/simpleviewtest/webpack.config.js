const path = require("path");

module.exports = {
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
      },
      {
        test: /azure-storage|AzureFileHandler|UrlFileHandler/,
        use: "null-loader"
      }
    ]
  },
  stats: "errors-only",
  externals: {
    electron: "require('electron')"
  }
};
