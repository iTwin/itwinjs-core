/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const path = require("path");
const webpack = require("webpack");
const LicenseWebpackPlugin = require("license-webpack-plugin").LicenseWebpackPlugin;
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");
const paths = require("./paths");
const helpers = require("./helpers");

// Webpack uses `publicPath` to determine where the app is being served from.
// It requires a trailing slash, or the file assets will get an incorrect path.
const publicPath = paths.servedPath;

const baseConfiguration = require("./webpack.config.backend.base")(publicPath);

//======================================================================================================================================
// This is the PRODUCTION configuration.
// It compiles slowly and is focused on producing a fast and minimal bundle.
//======================================================================================================================================
module.exports = helpers.mergeWebpackConfigs(baseConfiguration, {
  // Don't attempt to continue if there are any errors.
  bail: true,
  // We generate sourcemaps in production. This is slow but gives good results.
  // You can exclude the *.map files from the build during deployment.
  devtool: "source-map",
  module: {
    rules: [
      // Exclude web backend source in an electron build; electron backend source in a web build
      {
        test: /\.(t|j)sx?$/,
        loader: require.resolve("null-loader"),
        include: (process.env.ELECTRON_ENV === "production") ? paths.appSrcBackendWeb : paths.appSrcBackendElectron,
      },
    ],
  },
  plugins: [
    // Minify the code.
    new UglifyJSPlugin({
      parallel: true,
      uglifyOptions: {
        mangle: {
          // NEEDSWORK: Mangling classnames appears to break gateway marshalling...
          keep_classnames: true,
        },
        compress: {
          // Compressing classnames also breaks reflection
          keep_classnames: true,
          warnings: false,
          // Disabled because of an issue with Uglify breaking seemingly valid code:
          // https://github.com/facebookincubator/create-react-app/issues/2376
          // Pending further investigation:
          // https://github.com/mishoo/UglifyJS2/issues/2011
          comparisons: false,
        },
        output: {
          comments: false,
          // Turned on because emoji and regex is not minified properly using default
          // https://github.com/facebookincubator/create-react-app/issues/2488
          ascii_only: true,
        },
        sourceMap: true,
      },
    }),
    // Find and bundle all license notices from package dependencies
    new LicenseWebpackPlugin({
      pattern: /.*/,
    }),
  ],
});
