/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const path = require("path");
const webpack = require("webpack");
const autoprefixer = require("autoprefixer");

// the context directory (for looking up imports, etc.) is the original module source directory.
const contextDirectory = process.cwd();

module.exports = {
  mode: "development",
  context: contextDirectory,
  entry: { "main": path.resolve(__dirname, 'lib/frontend/index.js'), },
  output: {
    path: path.resolve(__dirname, "./lib/backend/public"),
    filename: '[name].bundle.js',
    devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
  },
  devtool: "cheap-module-source-map",
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "source-map-loader",
        enforce: "pre"
      },
      {
        test: /\.scss$/,
        use: {
          loader: require.resolve("sass-loader"),
          options: {
            includePaths: [path.resolve(__dirname, "node_modules")]
          },
        },
        enforce: "pre",
      },
      {
        // "oneOf" will traverse all following loaders until one will
        // match the requirements. When no loader matches it will fall
        // back to the "file" loader at the end of the loader list.
        oneOf: [
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
          // "url" loader works just like "file" loader but it also embeds
          // assets smaller than specified size as data URLs to avoid requests.
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
              options: { name: "static/media/[name].[hash:8].[ext]", },
            }
          },
          // ** STOP ** Are you adding a new loader?
          // Make sure to add the new loader(s) before the "file" loader.
        ],
      },
    ]
  },
  optimization: {
    // create only one runtime chunk.
    runtimeChunk: "single",
    moduleIds: "named",
  },
  node: {
    Buffer: false,
    fs: "empty",
    process: true
  },
  stats: "errors-only",
  externals: {
    electron: "require('electron')",
    '@bentley/bentleyjs-core': 'bentleyjs_core',
    '@bentley/geometry-core': 'geometry_core',
    '@bentley/imodeljs-i18n': 'imodeljs_i18n',
    '@bentley/imodeljs-clients': 'imodeljs_clients',
    '@bentley/imodeljs-common': 'imodeljs_common',
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
    'lodash': { root: '_', commonjs2: 'lodash', commonjs: 'lodash', amd: 'lodash' }
  },
};
