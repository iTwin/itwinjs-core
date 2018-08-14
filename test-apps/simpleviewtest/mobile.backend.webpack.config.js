const path = require("path");

module.exports = {
  mode: "development",
  entry: "./lib/backend/MobileMain.js",
  output: {
    path: path.resolve(__dirname, "./lib/mobile"),
    filename: "MobileMain.js",
    pathinfo: true,
  },
  target: "webworker",
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "source-map-loader",
        enforce: "pre"
      },
      {
        test: /growl\.js$/,
        use: 'null-loader'
      },
      {
        test: /xunit\.js$/,
        use: 'null-loader'
      },
      {
        test: /bunyan/,
        use: 'null-loader'
      }
    ]
  },
  externals: {
    "@bentley/imodeljs-electronaddon": "throw new Error('should never happen')",
    "@bentley/imodeljs-nodeaddon": "throw new Error('should never happen')",
    "electron": "throw new Error('should never happen')",
    "IModelJsFs": "{IModelJsFs: IModelJsFs}",
    "./IModelJsFs": "{IModelJsFs: IModelJsFs}",
    "../IModelJsFs": "{IModelJsFs: IModelJsFs}",
    "fs": "IModelJsFs",
    "fs-extra": "IModelJsFs"
  },
  stats: {
    warnings: false
  }
}