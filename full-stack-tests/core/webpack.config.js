/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const glob = require("glob");
const webpack = require("webpack");
const fs = require("fs");

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

loadEnv(path.join(__dirname, ".env"));

function createConfig(shouldInstrument) {
  const config = {
    mode: "development",
    entry: glob.sync(path.resolve(__dirname, "lib/**/*.test.js")),
    output: {
      path: path.resolve(__dirname, "lib/dist"),
      filename: "bundled-tests.js",
      devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
    },
    devtool: "nosources-source-map",
    resolve: { mainFields: ["main", "module"] },
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
          exclude: /common[\/\\]temp[\/\\]node_modules/,
          use: "source-map-loader",
          enforce: "pre"
        },
        {
          test: /azure-storage|AzureFileHandler|UrlFileHandler/,
          use: "null-loader"
        },
        {
          test: /ws\/index\.js$/,
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
          }, {
            IMODELJS_CORE_DIRNAME: JSON.stringify(path.join(__dirname, "../..")),
          }),
      }),
    ]
  };

  if (shouldInstrument) {
    config.output.filename = "bundled-tests.instrumented.js";
    config.module.rules.push({
      test: /\.(jsx?|tsx?)$/,
      include: [
        path.join(__dirname, "../../core/backend"),
        path.join(__dirname, "../../core/frontend"),
      ],
      loader: require.resolve("istanbul-instrumenter-loader"),
      options: {
        debug: true
      },
      enforce: "post",
    });
  }

  return config;
}

// Exporting two configs in a array like this actually tells webpack to run twice - once for each config.
module.exports = [
  // FIXME: Temporarily disabling instrumented bundle, because this webpack run is taking too long.
  // Also hoping this fixes our source-map-loader out of memory issue for now...
  // createConfig(true),
  createConfig(false)
]
