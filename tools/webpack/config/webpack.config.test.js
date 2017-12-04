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
  /\.s?css$/,
  /\.svg$/,
  /\.d\.ts$/,
  paths.appMainJs,
  paths.appIndexJs,
  paths.appSrcBackendElectron,
  paths.appSrcBackendWeb,
]

const isCoverage = (process.env.MOCHA_ENV === "coverage");
const coverageLoaders = (isCoverage) ? [
  {
    test: /\.(jsx?|tsx?)$/,
    include: paths.appSrc, // instrument only testing sources with Istanbul, after ts-loader runs
    exclude: [paths.appBackendNodeModules, paths.appFrontendNodeModules].concat(modulesToIgnore),
    loader: require.resolve('istanbul-instrumenter-loader'),
    options: {esModules: true, debug: true},
    enforce: 'post',
  },
] : [];

// WIP: This is a temporary workaround to fix module resolution in the test directory...
const fixNodeModulesPaths = (context, request, callback) => {
  if (/\.node$/.test(request))
    console.log(request, context);
  try {
    const resolvedPath = require.resolve(request, {paths: [paths.appBackendNodeModules, paths.appFrontendNodeModules] });
    
    if (resolvedPath.startsWith(paths.appBackendNodeModules) || resolvedPath.startsWith(paths.appFrontendNodeModules)) {
      return callback(null, 'commonjs ' + resolvedPath);
    }
  } catch(e) {}

  callback();
}

const resolveIModeljsCommon = (str) => str.replace(paths.imodeljsCommonRegex, path.resolve(paths.appBackendNodeModules, "@bentley/imodeljs-backend"));

// This is the test configuration.
module.exports = {
  // Compile node compatible code
  target: 'node',
  
  // The "externals" configuration option provides a way of excluding dependencies from the output bundles.
  externals: [
    fixNodeModulesPaths,
    // Don't include anything from node_modules in the bundle
    nodeExternals({whitelist: modulesToIgnore}),
    // We also need the following work around to keep $(iModelJs-Common) modules out of the bundle:
    (ctx, req, cb) => (paths.imodeljsCommonRegex.test(req)) ? cb(null, 'commonjs ' + resolveIModeljsCommon(req)) : cb()
  ],
  
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
    modules: ['node_modules', paths.appNodeModules, paths.appBackendNodeModules, paths.appFrontendNodeModules, paths.appSrc].concat(
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
    // WIP: The fixNodeModulesPaths hack above introduced some "Critical dependency: the request of a dependency is an expression" webpack warning.
    // This "noparse" avoids that warning. It's still a hack though - Webpack shouldn't even be trying to parse anything in imodeljs-react-scripts. 
    noParse: path.resolve(__dirname),  
    strictExportPresence: true,
    rules: [
      ...coverageLoaders,

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
          compilerOptions: { 
            // Replace $(iModelJs-Common) with @bentley/imodeljs-backend when compiling typescript
            paths: { "$(iModelJs-Common)/*": [ "backend/node_modules/@bentley/imodeljs-backend/*"] }
          },
          onlyCompileBundledFiles: true,
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
    // Automatically make React and sinon available
    new webpack.ProvidePlugin({
      React: "react",
      sinon: "sinon",
      expect: ["chai", "expect"],
      shallow: ["enzyme", "shallow"],
      mount: ["enzyme", "mount"],
    }),
    // Replace $(iModelJs-Common) with @bentley/imodeljs-backend when resolving modules
    new webpack.NormalModuleReplacementPlugin(paths.imodeljsCommonRegex, (r) => r.request = resolveIModeljsCommon(r.request)),
  ],
};
