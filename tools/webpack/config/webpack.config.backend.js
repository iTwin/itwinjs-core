/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const path = require("path");
const webpack = require("webpack");
const CaseSensitivePathsPlugin = require("case-sensitive-paths-webpack-plugin");
const WatchMissingNodeModulesPlugin = require("react-dev-utils/WatchMissingNodeModulesPlugin");
const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin");
const LicenseWebpackPlugin = require("license-webpack-plugin").LicenseWebpackPlugin;
const nodeExternals = require("webpack-node-externals");
const getClientEnvironment = require("./env");
const plugins = require("../scripts/utils/webpackPlugins");
const paths = require("./paths");
const helpers = require("./helpers");

// Webpack uses `publicPath` to determine where the app is being served from.
// In development, we always serve from the root. This makes config easier.
const publicPath = "/";
// `publicUrl` is just like `publicPath`, but we will provide it to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_PATH%/xyz looks better than %PUBLIC_PATH%xyz.
const publicUrl = "";
// Get environment variables to inject into our app.
const env = getClientEnvironment(publicUrl);

const resolveIModeljsCommon = (str) => str.replace(paths.imodeljsCommonRegex, "@bentley/imodeljs-backend");

const prodLoaders = (process.env.NODE_ENV !== "production") ? [] : [
  // Exclude web backend source in an electron build; electron backend source in a web build
  {
    test: /\.(t|j)sx?$/,
    loader: require.resolve("null-loader"),
    include: (process.env.ELECTRON_ENV === "production") ? paths.appSrcBackendWeb : paths.appSrcBackendElectron,
  },
];

// This is the development configuration.
// It is focused on developer experience and fast rebuilds.
// The production configuration is different and lives in a separate file.
module.exports = {
  // You may want "eval" instead if you prefer to see the compiled output in DevTools.
  // See the discussion in https://github.com/facebookincubator/create-react-app/issues/343.
  devtool: "cheap-module-source-map",
  // The "externals" configuration option provides a way of excluding dependencies from the output bundles.
  externals: [
    // We need the following work around to keep the native addon loader out of the bundle:
    /@bentley\/imodeljs-nodeaddon/,
    /@bentley\/imodeljs-electronaddon/,
  ],
  // These are the "entry points" to our application.
  // This means they will be the "root" imports that are included in JS bundle.
  // The first two entry points enable "hot" CSS and auto-refreshes for JS.
  entry: [
    paths.appMainJs
  ],
  output: {
    libraryTarget: "commonjs2",
    // Next line is not used in dev but WebpackDevServer crashes without it:
    path: paths.appLib,
    // Add /* filename */ comments to generated require()s in the output.
    pathinfo: true,
    filename: "main.js",
    // There are also additional JS chunk files if you use code splitting.
    chunkFilename: "[name].chunk.js",
    // This is the URL that app is served from. We use "/" in development.
    publicPath: publicPath,
    // Point sourcemap entries to original disk location (format as URL on Windows)
    devtoolModuleFilenameTemplate: helpers.createDevToolModuleFilename,
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
      ".js",
      ".json",
    ],
    plugins: [
      // Prevents users from importing files from outside of src/ (or node_modules/).
      // This often causes confusion because we only process files within src/ with babel.
      // To fix this, we prevent you from importing files out of src/ -- if you'd like to,
      // please link the files into your node_modules/ and let module-resolution kick in.
      // Make sure your source files are compiled, as they will not be processed in any way.
      new ModuleScopePlugin(paths.appSrc),
      // This is only for BACKEND code - frontend modules should be excluded from the bundle.
      new plugins.BanFrontendImportsPlugin(),
    ],
  },
  module: {
    strictExportPresence: true,
    rules: [
      // First, run the linter.
      {
        test: /\.ts$/,
        loader: require.resolve("tslint-loader"),
        enforce: "pre",
        include: paths.appSrc,
      },
      {
        test: /\.js$/,
        loader: require.resolve("source-map-loader"),
        enforce: "pre",
        include: helpers.createBentleySourceMapsIncludePaths(),
      },
      ...prodLoaders,
      // Compile .ts
      {
        test: /\.ts$/,
        include: paths.appSrc,
        loader: require.resolve("ts-loader"),
        options: {
          compilerOptions: { 
            // Replace $(iModelJs-Common) with @bentley/imodeljs-backend when compiling typescript
            paths: {"$(iModelJs-Common)/*": [ "../node_modules/@bentley/imodeljs-backend/*"] } 
          },
          onlyCompileBundledFiles: true,
          logLevel: "warn",
        }
      },
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
    new plugins.CopyAssetsPlugin(),
    new plugins.CopyNativeAddonsPlugin(),
    // Add module names to factory functions so they appear in browser profiler.
    new webpack.NamedModulesPlugin(),
    // Makes some environment variables available to the JS code, for example:
    // if (process.env.NODE_ENV === "development") { ... }. See `./env.js`.
    new webpack.DefinePlugin(env.stringified),
    new webpack.DefinePlugin({ "global.GENTLY": false }),
    // Watcher doesn't work well if you mistype casing in a path so we use
    // a plugin that prints an error when you attempt to do this.
    // See https://github.com/facebookincubator/create-react-app/issues/240
    new CaseSensitivePathsPlugin(),
    // If you require a missing module and then `npm install` it, you still have
    // to restart the development server for Webpack to discover it. This plugin
    // makes the discovery automatic so you don't have to restart.
    // See https://github.com/facebookincubator/create-react-app/issues/186
    new WatchMissingNodeModulesPlugin(paths.appNodeModules),
    // Replace $(iModelJs-Common) with @bentley/imodeljs-backend when resolving modules
    new webpack.NormalModuleReplacementPlugin(paths.imodeljsCommonRegex, (r) => r.request = resolveIModeljsCommon(r.request)),
    // Find and bundle all license notices from package dependencies
    new LicenseWebpackPlugin({
      pattern: /.*/,
    }),
  ]
};
