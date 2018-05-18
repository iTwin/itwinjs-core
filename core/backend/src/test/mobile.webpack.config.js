const path = require("path");

module.exports = {
  entry: "./lib/test/runMochaTestsDirectly.js",
  output: {
    path: path.resolve(__dirname, "../../lib/test/mobile"),
    filename: "runMochaTestsDirectly.js"
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
      }

    ]
  },
  externals: {
    "electron": "throw new Error('should never happen')",
    "@bentley/imodeljs-electronaddon": "throw new Error('should never happen')",
    "@bentley/imodeljs-nodeaddon": "throw new Error('should never happen')",
    "IModelJsFs": "{IModelJsFs: IModelJsFs}",
    "./IModelJsFs": "{IModelJsFs: IModelJsFs}",
    "../IModelJsFs": "{IModelJsFs: IModelJsFs}",
    "fs": "IModelJsFs",
    "fs-extra": "IModelJsFs",
  },
  stats: {
    warnings: false
  }
}