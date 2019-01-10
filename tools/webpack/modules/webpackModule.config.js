/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// This script sets module.export to the proper value for webpacking one of our packages as a Universal Module Definition library.
// All of the package's open source dependencies are set to external.
// All the other @bentley dependencies are set to external.

// arguments (specified on the package.json script line)
// env.sourcedir= : the source directory for the package. (Optional. If not specified, use ./)
// env.outdir= : the output directory for the webpack result, relative to env.sourcedir. (Optional. If not specified, use {env.sourcedir}/lib/module/{env.prod ? "prod", "dev"}/
// env.entry= : the entry point of the module in the compiled file (e.g. ./lib/imodeljs-frontend.js). Required
// env.bundlename= : the name of the bundled module (e.g. imodeljs-frontend). Required
// env.stylesheets : if specified (no value needed), sets up webpack to process .scss files into the bundle. Optional.
// env.prod : if specified, makes the production version of the module. (Optional. If not specified, builds the development version)

const path = require("path");
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const SpriteLoaderPlugin = require("svg-sprite-loader/plugin");
const autoprefixer = require("autoprefixer");

// NOTE: This was set up to return an array of configs, one for target: "web" and one for target: "node", but the node target didn't work, so I dropped it.
module.exports = (env) => { return getConfig(env, false); };

function dropDashes(name) {
  return name.replace("-", "_");
}

function getConfig(env, nodeAsTarget) {
  // set sourcedir if not specified in arguments.
  if (!env.sourcedir)
    env.sourcedir = "./";

  if (!env.outdir)
    env.outdir = "./lib/module" + (env.prod ? "/prod" : "/dev");

  // get the directory for the bundle.
  bundleDirectory = path.resolve(env.sourcedir, env.outdir);

  // the context directory (for looking up imports, etc.) is the original module source directory.
  const contextDirectory = path.resolve(env.sourcedir);

  // unless specified with env.prod, create a development build.
  const devMode = !(env.prod);

  // this is the "barrel" file of the module, which imports all of the sources.
  const bundleEntry = env.entry;

  // name of the output bundle.
  const bundleName = env.bundlename;

  // build the object for the webpack configuration
  const webpackLib = {
    context: contextDirectory,
    output: {
      path: bundleDirectory,
      filename: nodeAsTarget ? '[name].node.js' : '[name].js',
      library: dropDashes(bundleName),
      libraryTarget: 'umd',
      umdNamedDefine: true,
      jsonpFunction: 'webpackJsonp',  // used only for web target
      globalObject: 'this',           // used only for web target.
      devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
    },
    target: nodeAsTarget ? 'node' : 'web',
    externals: {
      '@bentley/bentleyjs-core': 'bentleyjs_core',
      '@bentley/geometry-core': 'geometry_core',
      '@bentley/bwc': 'bwc',
      '@bentley/imodeljs-i18n': 'imodeljs_i18n',
      '@bentley/imodeljs-clients': 'imodeljs_clients',
      '@bentley/imodeljs-common': 'imodeljs_common',
      '@bentley/imodeljs-quantity': 'imodeljs_quantity',
      '@bentley/imodeljs-frontend': 'imodeljs_frontend',
      '@bentley/ui-core': 'ui_core',
      '@bentley/ui-components': 'ui_components',
      '@bentley/ui-framework': 'ui_framework',
      '@bentley/ui-ninezone': 'ui_ninezone',
      '@bentley/presentation-common': 'presentation_common',
      '@bentley/presentation-components': 'presentation_components',
      '@bentley/presentation-frontend': 'presentation_frontend',
      'react': { root: 'React', commonjs2: 'react', commonjs: 'react', amd: 'react' },
      'react-dnd': { root: 'ReactDnD', commonjs2: 'react-dnd', commonjs: 'react-dnd', amd: 'react-dnd' },
      'react-dnd-html5-backend': { root: 'ReactDnDHTML5Backend', commonjs2: 'react-dnd5-html-backend', commonjs: 'react-dnd5-html-backend', amd: 'react-dnd5-html-backend' },
      'react-dom': { root: 'ReactDOM', commonjs2: 'react-dom', commonjs: 'react-dom', amd: 'react-dom' },
      'react-redux': { root: 'ReactRedux', commonjs2: 'react-redux', commonjs: 'react-redux', amd: 'react-redux' },
      'redux': { root: 'Redux', commonjs2: 'redux', commonjs: 'redux', amd: 'redux' },
      'inspire-tree': { root: 'InspireTree', commonjs2: 'inspire-tree', commonjs: 'inspire-tree', amd: 'inspire-tree' },
      'lodash': { root: '_', commonjs2: 'lodash', commonjs: 'lodash', amd: 'lodash' },
      'electron': 'commonjs electron',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          use: "source-map-loader",
          enforce: "pre"
        },
      ]
    },
    optimization: {
      // create only one runtime chunk.
      runtimeChunk: "single",
      moduleIds: "named",
    },
    node: {
      Buffer: true,
      fs: "empty",
      process: true
    },
    plugins: []
  };

  Object.defineProperty(webpackLib, "entry", { configurable: true, enumerable: true, writable: true, value: {} });
  Object.defineProperty(webpackLib.entry, bundleName, { configurable: true, enumerable: true, writable: true, value: bundleEntry });
  Object.defineProperty(webpackLib, "mode", { configurable: true, enumerable: true, writable: true, value: devMode ? "development" : "production" });
  Object.defineProperty(webpackLib, "devtool", { configurable: true, enumerable: true, writable: true, value: devMode ? "cheap-module-source-map" : "source-map" });

  if (!devMode) {
    webpackLib.optimization.minimizer = [
      new UglifyJSPlugin({
        uglifyOptions: {
          keep_classnames: true,
        },
        sourceMap: true
      })
    ];
  }

  // if using style sheets (import "xxx.scss" lines in .ts or .tsx files), then we need the sass-loader
  if (env.stylesheets) {
    cssRules = [{
      test: /\.scss$/,
      use: {
        loader: require.resolve("sass-loader"),
        options: {
          includePaths: [path.resolve(contextDirectory, "node_modules")]
        },
      },
      enforce: "pre",
    },
    {
      // "oneOf" will traverse all following loaders until one will
      // match the requirements. When no loader matches it will fall
      // back to the "file" loader at the end of the loader list.
      oneOf: [
        // "url" loader works just like "file" loader but it also embeds
        // assets smaller than specified size as data URLs to avoid requests.
        // "style" loader turns CSS into JS modules that inject <style> tags.
        // In development "style" loader enables hot editing of CSS.
        {
          test: /\.s?css$/,
          use: [
            require.resolve("style-loader"),
            {
              loader: require.resolve("css-loader"),
              options: {
                importLoaders: 1,
              },
            },
            {
              loader: require.resolve("postcss-loader"),
              options: {
                // Necessary for external CSS imports to work
                // https://github.com/facebook/create-react-app/issues/2677
                ident: "postcss",
                plugins: () => [
                  require("postcss-flexbugs-fixes"),
                  autoprefixer({
                    browsers: [
                      ">1%",
                      "last 4 versions",
                      "Firefox ESR",
                      "not ie < 9", // React doesn't support IE8 anyway
                    ],
                    flexbox: "no-2009",
                  }),
                ],
              },
            },
          ]
        },
        {
          test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
          use: {
            loader: require.resolve("url-loader"),
            options: {
              limit: 10000,
              name: "static/media/[name].[hash:8].[ext]",
            },
          }
        },
        {
          test: /\.svg$/,
          issuer: { exclude: /\.css$/ },
          use: {
            loader: require.resolve("svg-sprite-loader"),
            options: {
              runtimeCompat: true,
              spriteFilename: "sprite-[hash:6].svg"
            },
          }
        },
        // "file" loader makes sure assets end up in the `lib` folder.
        // When you `import` an asset, you get its filename.
        // This loader doesn't use a "test" so it will catch all modules
        // that fall through the other loaders.
        {
          // Exclude `js` files to keep "css" loader working as it injects
          // its runtime that would otherwise be processed through "file" loader.
          // Also exclude `html` and `json` extensions so they get processed
          // by webpacks internal loaders.
          exclude: [/\.(js|jsx|mjs)$/, /\.html$/, /\.json$/],
          use: {
            loader: require.resolve("file-loader"),
            options: {
              name: "static/media/[name].[hash:8].[ext]",
            },
          }
        },
        // ** STOP ** Are you adding a new loader?
        // Make sure to add the new loader(s) before the "file" loader.
      ],
    },
    ];

    webpackLib.module.rules = webpackLib.module.rules.concat(cssRules);
    webpackLib.plugins = webpackLib.plugins.concat([new SpriteLoaderPlugin()]);
  }

  webpackLib.output.library = dropDashes(webpackLib.output.library);
  // console.log ("webpackLib :",  webpackLib);

  return webpackLib;
}