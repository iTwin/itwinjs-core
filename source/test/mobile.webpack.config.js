const path = require ("path");

module.exports = {
  entry: "./lib/test/runMochaTestsDirectly.js",
  output: {
    path: path.resolve(__dirname, "./lib/test/mobile"),
    filename: "runMochaTestsDirectly.js"
  },
  devtool: "source-map",
  module: {
    rules:[
      {
        test: /\.js$/,
        use: "source-map-loader",
        enforce: "pre"
      },
      {
        test: /growl|xunit\.js$/,
        use: 'null-loader'
      }

    ]
  },
  stats: {
    warnings: false
  }
}