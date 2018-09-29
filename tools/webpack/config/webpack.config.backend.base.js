/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const path = require("path");
const webpack = require("webpack");
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CaseSensitivePathsPlugin = require("case-sensitive-paths-webpack-plugin");
const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin");
const nodeExternals = require("webpack-node-externals");
const getClientEnvironment = require("./env");
const plugins = require("../scripts/utils/webpackPlugins");
const paths = require("./paths");
const helpers = require("./helpers");

//======================================================================================================================================
// This is the BASE configuration.
// It contains settings which are common to both PRODUCTION and DEVELOPMENT configs.
//======================================================================================================================================
module.exports = (publicPath) => {
  // `publicUrl` is just like `publicPath`, but we will provide it to our app
  // as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
  // Omit trailing slash as %PUBLIC_URL%/xyz looks better than %PUBLIC_URL%xyz.
  const publicUrl = publicPath.slice(0, -1);
  // Get environment variables to inject into our app.
  const env = getClientEnvironment(publicUrl);

  return {
    // The "externals" configuration option provides a way of excluding dependencies from the output bundles.
    externals: {
      // We need the following work around to keep the native addon loader out of the bundle:
      "@bentley/imodeljs-electronaddon": "@bentley/imodeljs-electronaddon",
      "@bentley/imodeljs-nodeaddon": "@bentley/imodeljs-nodeaddon",
      "@bentley/imodeljs-nodeaddon/NodeAddonLoader": "@bentley/imodeljs-nodeaddon/NodeAddonLoader",
      "@bentley/imodeljs-nodeaddonapi/package.json": "@bentley/imodeljs-nodeaddonapi/package.json",
      "@bentley/imodeljs-native-platform-electron": "@bentley/imodeljs-native-platform-electron",
      "@bentley/imodeljs-native-platform-node": "@bentley/imodeljs-native-platform-node",
      "@bentley/imodeljs-native-platform-node/NodeAddonLoader": "@bentley/imodeljs-native-platform-node/NodeAddonLoader",
      "@bentley/imodeljs-native-platform-api/package.json": "@bentley/imodeljs-native-platform-api/package.json",
    },
    // These are the "entry points" to our application.
    // This means they will be the "root" imports that are included in JS bundle.
    entry: [
      paths.appMainJs
    ],
    output: {
      libraryTarget: "commonjs2",
      // The build folder.
      // Next line is not used in dev but WebpackDevServer crashes without it:
      path: paths.appLib,
      // This is the URL that app is served from. We use "/" in development.
      // In production, we inferred the "public path" (such as / or /my-project) from homepage.
      publicPath: publicPath,
      // Point sourcemap entries to original disk location (format as URL on Windows)
      devtoolModuleFilenameTemplate: helpers.createDevToolModuleFilename,
      // The name of the output bundle.
      filename: "main.js",
      // There are also additional JS chunk files if you use code splitting.
      chunkFilename: "[name].chunk.js",
    },
    resolve: {
      // This allows you to set a fallback for where Webpack should look for modules.
      // We placed these paths second because we want `node_modules` to "win"
      // if there are any conflicts. This matches Node resolution mechanism.
      // https://github.com/facebookincubator/create-react-app/issues/253
      modules: ["node_modules", paths.appNodeModules, paths.appSrc].concat(
        (process.env.NODE_PATH || "").split(path.delimiter).filter(Boolean)
      ),
      extensions: [
        ".ts",
        ".mjs",
        ".js",
        ".json",
      ],
      plugins: [
        // Prevents users from importing files from outside of src/ (or node_modules/).
        // This often causes confusion because we only process files within src/ with babel.
        // To fix this, we prevent you from importing files out of src/ -- if you'd like to,
        // please link the files into your node_modules/ and let module-resolution kick in.
        // Make sure your source files are compiled, as they will not be processed in any way.
        // FIXME: new ModuleScopePlugin(paths.appSrc),
        // This is only for BACKEND code - frontend modules should be excluded from the bundle.
        new plugins.BanFrontendImportsPlugin(),
      ],
    },
    module: {
      noParse: [
        // Don't parse dtrace-provider for `require` calls.
        // It attempts to include (optional) DTrace bindings on MacOS only.
        // According to the bunyan README (https://github.com/trentm/node-bunyan#webpack), we can safely ignore this.
        /dtrace-provider.js$/,
        // Don't parse this file in express - it's causing another "the request of a dependency is an expression" error.
        // As far as I can tell, this attempts to dynamically include an optional templating engine, which we shouldn't need anyway...
        /express[\\\/]lib[\\\/]view.js$/,
      ],
      strictExportPresence: true,
      rules: [
        {
          test: /\.js$/,
          loader: require.resolve("source-map-loader"),
          enforce: "pre",
          include: helpers.createBentleySourceMapsIncludePaths,
        },
        {
          // "oneOf" will traverse all following loaders until one will match the requirements.
          oneOf: [
            // Compile .ts
            {
              test: /\.ts$/,
              include: paths.appSrc,
              use: {
                loader: require.resolve("ts-loader"),
                options: {
                  transpileOnly: true,
                  experimentalWatchApi: (process.env.NODE_ENV === "development"),
                  onlyCompileBundledFiles: true,
                  logLevel: "warn",
                  compilerOptions: {
                    declaration: false,
                    declarationMap: false,
                  }
                }
              }
            },
          ],
        }
      ],
    },
    target: "electron-main",
    node: {
      console: false,
      global: false,
      process: false,
      __filename: false,
      __dirname: false,
      Buffer: false,
      setImmediate: false
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        tsconfig: paths.appTsConfig,
        tslint: paths.appTsLint,
        async: false,
        silent: true,
      }),
      new plugins.CopyAppAssetsPlugin(),
      new plugins.CopyBentleyStaticResourcesPlugin(["assets"]),
      new plugins.CopyNativeAddonsPlugin(),
      // Makes some environment variables available to the JS code, for example:
      // if (process.env.NODE_ENV === "development") { ... }. See `./env.js`.
      new webpack.DefinePlugin(env.backendStringified),
      new webpack.DefinePlugin({
        "global.GENTLY": false
      }),
      // Watcher doesn't work well if you mistype casing in a path so we use
      // a plugin that prints an error when you attempt to do this.
      // See https://github.com/facebookincubator/create-react-app/issues/240
      new CaseSensitivePathsPlugin(),
    ]
  };
};