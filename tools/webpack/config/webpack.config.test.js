/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const path = require("path");
const webpack = require("webpack");
const CaseSensitivePathsPlugin = require("case-sensitive-paths-webpack-plugin");
const WatchMissingNodeModulesPlugin = require("react-dev-utils/WatchMissingNodeModulesPlugin");
const getClientEnvironment = require("./env");
const paths = require("./paths");
const nodeExternals = require("webpack-node-externals");
const helpers = require("./helpers");

// `publicUrl` is just like `publicPath`, but we will provide it to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_PATH%/xyz looks better than %PUBLIC_PATH%xyz.
const publicUrl = "PUBLIC_URL";
// Get environment variables to inject into our app.
const env = getClientEnvironment(publicUrl);

// This is the test configuration.
const config = {
  mode: "development",

  // Compile node compatible code
  target: "node",

  // The base directory, an absolute path, for resolving entry points and loaders from configuration.
  context: paths.appTest,

  output: {
    // The build folder.
    // Next line is not used in dev but WebpackDevServer crashes without it:
    path: paths.appLib,
    // The name of the output bundle.
    filename: "test.js",
  },
  // The "externals" configuration option provides a way of excluding dependencies from the output bundles.
  externals: [
    // Don't include anything from node_modules in the bundle
    nodeExternals({
      whitelist: [
        ...helpers.modulesToExcludeFromTests,
        /bwc-polymer/,
        /\.s?css$/,
        /\.svg$/,
        /\.d\.ts$/,
      ]
    }),
  ],

  // You may want "eval" instead if you prefer to see the compiled output in DevTools.
  // See the discussion in https://github.com/facebookincubator/create-react-app/issues/343.
  devtool: "inline-source-map",
  output: {
    path: paths.appLib,
    publicPath: "",
    devtoolModuleFilenameTemplate: "[absolute-resource-path]",
    devtoolFallbackModuleFilenameTemplate: "[absolute-resource-path]?[hash]"
  },
  resolve: {
    // This allows you to set a fallback for where Webpack should look for modules.
    // We placed these paths second because we want `node_modules` to "win"
    // if there are any conflicts. This matches Node resolution mechanism.
    // https://github.com/facebookincubator/create-react-app/issues/253
    modules: ["node_modules", paths.appNodeModules, paths.appSrc].concat(
      // It is guaranteed to exist because we tweak it in `env.js`
      process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
    ),
    // These are the reasonable defaults supported by the Node ecosystem.
    // We also include JSX as a common component filename extension to support
    // some tools, although we do not recommend using it, see:
    // https://github.com/facebookincubator/create-react-app/issues/290
    // `web` extension prefixes have been added for better support
    // for React Native Web.
    extensions: [
      ".web.ts",
      ".ts",
      ".web.tsx",
      ".tsx",
      ".web.js",
      ".js",
      ".json",
      ".web.jsx",
      ".jsx",
    ],
  },
  module: {
    // WIP: The fixNodeModulesPaths hack above introduced some "Critical dependency: the request of a dependency is an expression" webpack warning.
    // This "noParse" avoids that warning. It's still a hack though - Webpack shouldn't even be trying to parse anything in @bentley/webpack-tools.
    noParse: path.resolve(__dirname),
    strictExportPresence: true,
    rules: [
      // WIP: This is a temporary (hack) workaround for the supporting snapshots with mocha-webpack.
      {
        test: /.*\.test\.(jsx?|tsx?)$/,
        enforce: "post",
        use: {
          loader: require.resolve("imports-loader"),
          query: "describe=>global.globalMochaHooks(__filename)",
        }
      },
      // First, run the linter.
      // It's important to do this before Typescript runs.
      {
        test: /\.(ts|tsx)$/,
        loader: require.resolve("tslint-loader"),
        enforce: "pre",
        include: [paths.appTest], // Only lint test code - app code is already linted by the regular build.
      },
      {
        // "oneOf" will traverse all following loaders until one will
        // match the requirements. When no loader matches it will fall
        // back to the "file" loader at the end of the loader list.
        oneOf: [
          {
            test: helpers.modulesToExcludeFromTests,
            use: require.resolve("null-loader"),
          },
          // Compile .tsx?
          {
            test: /\.(ts|tsx)$/,
            exclude: /(node_modules|bower_components)/,
            use: {
              loader: require.resolve("ts-loader"),
              options: {
                // onlyCompileBundledFiles: true,
                logLevel: "warn"
              },
            }
          },
          // "file" loader makes sure assets end up in the `lib` folder.
          // When you `import` an asset, you get its filename.
          // This loader doesn't use a "test" so it will catch all modules
          // that fall through the other loaders.
          {
            // Exclude `js`, `html`, and `json` extensions so they get processed by webpack's internal loaders.
            exclude: [/\.(js|jsx|mjs)$/, /\.html$/, /\.json$/],
            use: {
              loader: require.resolve("file-loader"),
              options: {
                emitFile: false, // don't actually emit the file to the `lib` folder; we just want the filename returned in tests
                name: "[path][name].[ext]",
              },
            }
          },
        ]
      }
      // ** STOP ** Are you adding a new loader?
      // Make sure to add the new loader(s) before the "file" loader.
    ],
  },
  plugins: [
    // Makes some environment variables available to the JS code, for example:
    // if (process.env.NODE_ENV === "development") { ... }. See `./env.js`.
    new webpack.DefinePlugin(env.frontendStringified),
    // Watcher doesn't work well if you mistype casing in a path so we use
    // a plugin that prints an error when you attempt to do this.
    // See https://github.com/facebookincubator/create-react-app/issues/240
    new CaseSensitivePathsPlugin(),
    // If you require a missing module and then `npm install` it, you still have
    // to restart the development server for Webpack to discover it. This plugin
    // makes the discovery automatic so you don't have to restart.
    // See https://github.com/facebookincubator/create-react-app/issues/186
    // FIXME: new WatchMissingNodeModulesPlugin(paths.appNodeModules),
    // Automatically make React and sinon available
    new webpack.ProvidePlugin({
      React: "react",
      sinon: "sinon",
      expect: ["chai", "expect"],
      shallow: ["enzyme", "shallow"],
      mount: ["enzyme", "mount"],
    }),
  ],
  node: {
    __filename: true,
    __dirname: true,
  }
};

module.exports = helpers.getCustomizedWebpackConfig(paths.appWebpackConfigTest, config);
