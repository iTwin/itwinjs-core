const path = require ("path");

module.exports = {
  entry: "./lib/test/runMochaTestsDirectly.js",
  output: {
    path: path.resolve(__dirname, "./lib/test/mobile"),
    filename: "runMochaTestsDirectly.js"
  },
  target: "webworker",
  devtool: "source-map",
  module: {
    rules:[
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
        test: /imodeljs-electronaddon$/,
        use: 'null-loader'
      },
      {
        test: /imodeljs-nodeaddon$/,
        use: 'null-loader'
      }

    ]
  },
  exclude: [
    path.resolve(__dirname, '../backend/IModelJsFs.js'),
  ],
  externals: {
    "@bentley/imodeljs-mobile": "require('@bentley/imodeljs-mobile')",
    "IModelJsFs": "IModelJsFs"
  },
  stats: {
    warnings: false
  }
}