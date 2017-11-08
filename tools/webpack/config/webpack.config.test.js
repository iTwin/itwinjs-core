/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
'use strict';

const autoprefixer = require('autoprefixer');
const path = require('path');
const webpack = require('webpack');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
const getClientEnvironment = require('./env');
const paths = require('./paths');
const nodeExternals = require('webpack-node-externals');

// `publicUrl` is just like `publicPath`, but we will provide it to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_PATH%/xyz looks better than %PUBLIC_PATH%xyz.
const publicUrl = 'PUBLIC_URL';
// Get environment variables to inject into our app.
const env = getClientEnvironment(publicUrl);

const modulesToIgnore = [
  /bwc-polymer/,
  /node_modules[\/\\]ws/,
  /\.s?css$/,
  /\.svg$/,
  /\.d\.ts$/,
  paths.appMainJs,
  paths.appIndexJs,
  paths.appSrcElectron,
]

// WIP: This is needed for the imports-loader hack below.
const nodeExternalsWhitelist = modulesToIgnore.concat([/@bentley/])

const isCoverage = (process.env.MOCHA_ENV === "coverage");
const coverageLoaders = (isCoverage) ? [
  {
    test: /\.(jsx?|tsx?)$/,
    include: paths.appSrc, // instrument only testing sources with Istanbul, after ts-loader runs
    loader: require.resolve('istanbul-instrumenter-loader'),
    options: {esModules: true, debug: true},
    enforce: 'post',
  },
] : [];

// WIP: This is needed to configure our custom chai assertions...
const fixCustomAssertionsRelPaths = (context, request, callback) => {
  if (/customAssertions\.js$/.test(request)){
    return callback(null, 'commonjs ' + path.resolve(context, request));
  }
  callback();
}

// WIP: This is also needed for the imports-loader hack below.
const fixAddonLoaderRelPaths = (context, request, callback) => {
  if (/addonLoader/.test(request)){
    return callback(null, 'commonjs ' + path.resolve(context, request));
  }
  callback();
}

// This is the test configuration.
module.exports = {
  // Compile node compatible code
  target: 'node',
  
  // Ignore all modules in node_modules folder
  externals: [
    fixCustomAssertionsRelPaths,
    fixAddonLoaderRelPaths,
    nodeExternals({whitelist: nodeExternalsWhitelist})],

  // You may want 'eval' instead if you prefer to see the compiled output in DevTools.
  // See the discussion in https://github.com/facebookincubator/create-react-app/issues/343.
  devtool: 'inline-cheap-module-source-map',
  output: {
    devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    devtoolFallbackModuleFilenameTemplate: '[absolute-resource-path]?[hash]'
  },
  resolve: {
    // This allows you to set a fallback for where Webpack should look for modules.
    // We placed these paths second because we want `node_modules` to "win"
    // if there are any conflicts. This matches Node resolution mechanism.
    // https://github.com/facebookincubator/create-react-app/issues/253
    modules: ['node_modules', paths.appNodeModules, paths.appSrc].concat(
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
      '.web.ts',
      '.ts',
      '.web.tsx',
      '.tsx',
      '.web.js',
      '.js',
      '.json',
      '.web.jsx',
      '.jsx',
    ],
  },
  module: {
    strictExportPresence: true,
    rules: [
      ...coverageLoaders,

      // WIP: This is a temporary (hack) workaround for the tiering in bentleyjs-core
      // thinking we're in a browser just because document is defined.
      {
        loader: require.resolve('imports-loader'),
        query: "document=>{}",
        test: /@bentley.*\.(jsx?|tsx?)$/,
        enforce: 'post',
      },
      // WIP: This is a temporary (hack) workaround for the suppoting snapshots with mocha-webpack.
      {
        loader: require.resolve('imports-loader'),
        query: "globalMochaHooks=>global.globalMochaHooks()",
        test: /.*\.test\.(jsx?|tsx?)$/,
        enforce: 'post',
      },

      // First, run the linter.
      // It's important to do this before Babel processes the JS.
      {
        test: /\.(ts|tsx)$/,
        loader: require.resolve('tslint-loader'),
        enforce: 'pre',
        include: [paths.appTest], // Only lint test code - app code is already linted by the regular build.
      },

      // ** ADDING/UPDATING LOADERS **
      // The "file" loader handles all assets unless explicitly excluded.
      // The `exclude` list *must* be updated with every change to loader extensions.
      // When adding a new loader, you must add its `test`
      // as a new entry in the `exclude` list for "file" loader.

      // "file" loader makes sure those assets get served by WebpackDevServer.
      // When you `import` an asset, you get its (virtual) filename.
      // In production, they would get copied to the `build` folder.
      {
        exclude: [
          /\.html$/,
          // We have to write /\.(js|jsx)(\?.*)?$/ rather than just /\.(js|jsx)$/
          // because you might change the hot reloading server from the custom one
          // to Webpack's built-in webpack-dev-server/client?/, which would not
          // get properly excluded by /\.(js|jsx)$/ because of the query string.
          // Webpack 2 fixes this, but for now we include this hack.
          // https://github.com/facebookincubator/create-react-app/issues/1713
          /\.(js|jsx)(\?.*)?$/,
          /\.(ts|tsx)(\?.*)?$/,
          /\.css$/,
          /\.json$/,
          /\.scss$/,
        ],
        loader: require.resolve('file-loader'),
        options: {
          emitFile: false,
          name: '[path][name].[ext]',
        },
      },
      { 
        test: modulesToIgnore,
        use: require.resolve('null-loader'),
      },
      // Compile .tsx?
      {
        test: /\.(ts|tsx)$/,
        exclude: /(node_modules|bower_components)/,
        loader: require.resolve('ts-loader'),
        options: {
          logLevel: 'warn'
        },
      },
      // ** STOP ** Are you adding a new loader?
      // Remember to add the new extension(s) to the "url" loader exclusion list.
    ],
  },
  plugins: [
    // Makes some environment variables available to the JS code, for example:
    // if (process.env.NODE_ENV === 'development') { ... }. See `./env.js`.
    new webpack.DefinePlugin(env.stringified),
    // Watcher doesn't work well if you mistype casing in a path so we use
    // a plugin that prints an error when you attempt to do this.
    // See https://github.com/facebookincubator/create-react-app/issues/240
    new CaseSensitivePathsPlugin(),
    // If you require a missing module and then `npm install` it, you still have
    // to restart the development server for Webpack to discover it. This plugin
    // makes the discovery automatic so you don't have to restart.
    // See https://github.com/facebookincubator/create-react-app/issues/186
    new WatchMissingNodeModulesPlugin(paths.appNodeModules),
  ],
};
