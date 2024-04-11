/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const webpack = require("webpack");
const { globSync } = require("glob");

const frontendLib = path.resolve(__dirname, "../../../lib/cjs");

function createConfig(shouldInstrument) {
  const config = {
    mode: "development",
    entry: globSync(path.resolve(frontendLib, "test/**/*.test.js"), {
      windowsPathsNoEscape: true,
    }),
    output: {
      path: path.resolve(frontendLib, "test/webpack/"),
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
        {
          test: /azure-storage|AzureFileHandler|UrlFileHandler/,
          use: "null-loader"
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

  if (shouldInstrument) {
    config.output.filename = "bundled-tests.instrumented.js";
    config.module.rules.push({
      test: /\.(jsx?|tsx?)$/,
      include: frontendLib,
      exclude: path.join(frontendLib, "test"),
      use: {
        loader: "babel-loader",
        options: {
          plugins: ["babel-plugin-istanbul"],
        },
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
