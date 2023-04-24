/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const webpack = require("webpack");
const glob = require("glob");

const frontendLib = path.resolve(__dirname, "../../../lib/cjs");

function createConfig(shouldInstrument) {
  const config = {
    mode: "development",
    entry: glob.sync(path.resolve(frontendLib, "test/**/*.test.js")),
    output: {
      path: path.resolve(frontendLib, "test/webpack/"),
      filename: "bundled-tests.js",
      devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
    },
    devtool: "nosources-source-map",
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
    optimization: {
      nodeEnv: "production"
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

  if (shouldInstrument) {
    config.output.filename = "bundled-tests.instrumented.js";
    config.module.rules.push({
      test: /\.(jsx?|tsx?)$/,
      include: frontendLib,
      exclude: path.join(frontendLib, "test"),
      use: {
        loader: 'babel-loader',
        options: {
          plugins: ['babel-plugin-istanbul']
        }
      },
      enforce: "post",
    });
  }

  return config;
}

// Runs webpack once for each config in the export array
module.exports = [
  createConfig(false),
  createConfig(true)
]
