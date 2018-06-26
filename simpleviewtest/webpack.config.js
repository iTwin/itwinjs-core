const path = require("path");
const glob = require("glob");

module.exports = {
  entry: glob.sync(path.resolve(__dirname, "lib/frontend/**/*.js")),
  output: {
    path: path.resolve(__dirname, "./lib/backend/public"),
    filename: "bundle.js",
    devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
  },
  devtool: "nosources-source-map",
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
