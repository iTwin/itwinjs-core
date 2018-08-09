/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const path = require("path");
const webpack = require("webpack");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
const paths = require("./paths");
const helpers = require("./helpers");
const plugins = require("../scripts/utils/webpackPlugins");

// Webpack uses `publicPath` to determine where the app is being served from.
// It requires a trailing slash, or the file assets will get an incorrect path.
const publicPath = paths.servedPath;

const baseConfiguration = require("./webpack.config.backend.base")(publicPath);

//======================================================================================================================================
// This is the PRODUCTION configuration.
// It compiles slowly and is focused on producing a fast and minimal bundle.
//======================================================================================================================================
const config = helpers.mergeWebpackConfigs(baseConfiguration, {
  mode: "production",
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
  optimization: {
    // Minify the code.
    minimizer: [
      new UglifyJsPlugin({
        uglifyOptions: {
          ecma: 8,
          mangle: {
            safari10: true,
            // NEEDSWORK: Mangling classnames appears to break gateway marshalling...
            keep_classnames: true,
          },
          compress: {
            warnings: false,
            // Disabled because of an issue with Uglify breaking seemingly valid code:
            // https://github.com/facebook/create-react-app/issues/2376
            // Pending further investigation:
            // https://github.com/mishoo/UglifyJS2/issues/2011
            comparisons: false,
            // Compressing classnames also breaks reflection
            keep_classnames: true,
          },
          output: {
            comments: false,
            // Turned on because emoji and regex is not minified properly using default
            // https://github.com/facebook/create-react-app/issues/2488
            ascii_only: true,
          },
        },
        // Use multi-process parallel running to improve the build speed
        // Default number of concurrent runs: os.cpus().length - 1
        parallel: true,
        // Enable file caching
        cache: true,
        sourceMap: true,
      }),
    ],
  },
  plugins: [
    // Find and bundle all license notices from package dependencies
    new plugins.PrettyLicenseWebpackPlugin({
      pattern: /.*/,
      includeUndefined: true,
      includePackagesWithoutLicense: true,
      unacceptablePattern: /^(GPL|.*[^L]GPL)/i,
    }),
  ],
});

module.exports = helpers.getCustomizedWebpackConfig(paths.appWebpackConfigBackend, config);
