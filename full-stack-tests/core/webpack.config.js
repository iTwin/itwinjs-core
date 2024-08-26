/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const { globSync } = require("glob");
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
    entry: globSync(path.resolve(__dirname, "lib/**/*.test.js"), {
      windowsPathsNoEscape: true,
    }),
    output: {
      path: path.resolve(__dirname, "lib/dist"),
      filename: "bundled-tests.js",
      devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]",
    },
    devtool: "nosources-source-map",
    resolve: {
      mainFields: ["main", "module"],
      fallback: {
        assert: require.resolve("assert"),
        crypto: require.resolve("crypto-browserify"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        path: require.resolve("path-browserify"),
        stream: require.resolve("stream-browserify"),
        zlib: require.resolve("browserify-zlib"),
      },
      alias: {
        "@azure/storage-blob$": "@azure/storage-blob/dist-esm/storage-blob/src/index.browser.js",
        "supports-color$": "supports-color/browser.js"
      }
    },
    module: {
      noParse: [
        // Don't parse draco_*_nodejs.js modules for `require` calls.  There are
        // requires for fs that cause it to fail even though the fs dependency
        // is not used.
        /draco_decoder_nodejs.js$/,
        /draco_encoder_nodejs.js$/,
      ],
      rules: [
        {
          test: /\.js$/,
          exclude: /common[\/\\]temp[\/\\]node_modules/,
          use: "source-map-loader",
          enforce: "pre",
        },
        {
          test: /azure-storage|AzureFileHandler|UrlFileHandler|AzureSdkFileHandler/,
          use: "null-loader",
        },
        {
          test: /ws\/index\.js$/,
          use: "null-loader",
        },
        {
          test: /tunnel.js/,
          use: "null-loader",
        },
      ],
    },
    stats: "errors-only",
    optimization: {
      nodeEnv: "production",
    },
    externals: {
      electron: "commonjs electron",
      fs
    },
    plugins: [
      // Makes some environment variables available to the JS code, for example:
      // if (process.env.NODE_ENV === "development") { ... }. See `./env.js`.
      new webpack.DefinePlugin({
        "process.env": Object.keys(process.env).reduce(
          (env, key) => {
            env[key] = JSON.stringify(process.env[key]);
            return env;
          },
          {
            IMODELJS_CORE_DIRNAME: JSON.stringify(
              path.join(__dirname, "../..")
            ),
          }
        ),
      }),
      // certa doesn't like chunks
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    ],
  };

  if (shouldInstrument) {
    config.output.filename = "bundled-tests.instrumented.js";
    config.module.rules.push({
      test: /\.(jsx?|tsx?)$/,
      include: [
        path.join(__dirname, "../../core/backend"),
        path.join(__dirname, "../../core/frontend"),
      ],
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
