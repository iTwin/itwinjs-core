/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const webpack = require("webpack");
const glob = require("glob");

const frontendLib = path.resolve(__dirname, "../../../../lib/cjs");

function createConfig() {
  const config = {
    mode: "development",
    entry: glob.sync(path.resolve(frontendLib, "test/frontend/**/*.test.js")),
    output: {
      path: path.resolve(frontendLib, "test/frontend/webpack/"),
      filename: "bundled-tests.js",
      devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
    },
    devtool: "nosources-source-map",
    module: {
      noParse: [
        // Don't parse draco_*_nodejs.js modules for `require` calls.  There are
        // requires for fs that cause it to fail even though the fs dependency
        // is not used.
        /draco_decoder_nodejs.js$/,
        /draco_encoder_nodejs.js$/
      ],
      rules: [
        {
          test: /\.js$/,
          use: "source-map-loader",
          enforce: "pre"
        },
      ]
    },
    stats: "errors-only",
    optimization: {
      nodeEnv: "production"
    },
    externals: {
      electron: "commonjs electron",
    },
    plugins: [
      // Makes some environment variables available to the JS code, for example:
      // if (process.env.NODE_ENV === "development") { ... }. See `./env.js`.
      new webpack.DefinePlugin({
        "process.env": Object.keys(process.env)
          .reduce((env, key) => {
            env[key] = JSON.stringify(process.env[key]);
            return env;
          }, {}),
      })
    ]
  };

  return config;
}

module.exports = [
  createConfig()
]
