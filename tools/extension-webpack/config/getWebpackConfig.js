/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

"use strict";

const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const getCSSModuleLocalIdent = require("react-dev-utils/getCSSModuleLocalIdent");
const { paths } = require("@bentley/webpack-tools-core/lib/utils/paths");
const { FrontendDefaultsPlugin, IModeljsLibraryImportsPlugin } = require("@bentley/webpack-tools-core");
const ForkTsCheckerWebpackPlugin = require("react-dev-utils/ForkTsCheckerWebpackPlugin");
const typescriptFormatter = require("react-dev-utils/typescriptFormatter");
const postcssNormalize = require("postcss-normalize");

const appPackageJson = require(paths.appPackageJson);

// Source maps are resource heavy and can cause out of memory issue for large source files.
const shouldUseSourceMap = !(process.env.DISABLE_SOURCE_MAPS === "true");
const imageInlineSizeLimit = parseInt(process.env.IMAGE_INLINE_SIZE_LIMIT || "10000");

// style files regexes
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

// This is the configuration factory
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
// options have been added to support a much faster but potentially unsafe configuration
module.exports = function (srcFile, outDir) {
  // common function to get style loaders
  const getStyleLoaders = (cssOptions, preProcessor) => {
    const loaders = [
      {
        loader: require.resolve("style-loader"),
      },
      {
        loader: require.resolve("css-loader"),
        options: cssOptions,
      },
      {
        // Options for PostCSS as we reference these options twice
        // Adds vendor prefixing based on your specified browser support in
        // package.json
        loader: require.resolve("postcss-loader"),
        options: {
          // Necessary for external CSS imports to work
          // https://github.com/facebook/create-react-app/issues/2677
          ident: "postcss",
          plugins: () => [
            require("postcss-flexbugs-fixes"),
            require("postcss-preset-env")({
              autoprefixer: {
                flexbox: "no-2009",
              },
              stage: 3,
            }),
            // Adds PostCSS Normalize as the reset css with default options,
            // so that it honors browserslist config in package.json
            // which in turn let's users customize the target behavior as per their needs.
            postcssNormalize(),
          ],
          sourceMap: shouldUseSourceMap,
        },
      },
    ];
    if (preProcessor) {
      // preProcessor has no options, is loader module name
      if (preProcessor.loader === undefined) {
        loaders.push(
          {
            loader: require.resolve("resolve-url-loader"),
            options: { sourceMap: shouldUseSourceMap, },
          },
          {
            loader: require.resolve(preProcessor),
            options: { sourceMap: shouldUseSourceMap, },
          }
        );
        // preProcessor is loader description object
      } else {
        loaders.push(preProcessor);
      }
    }
    return loaders;
  };

  const sassLoaderConfig = "sass-loader";

  const rawConfig = {
    mode: "production",
    // Stop compilation early in production
    bail: true,
    devtool: shouldUseSourceMap ? 'source-map' : false,
    // These are the "entry points" to our application.
    // This means they will be the "root" imports that are included in JS bundle.
    entry: [
      // Finally, this is your app's code:
      srcFile,
      // We include the app code last so that if there is a runtime error during
      // initialization, it doesn't blow up the WebpackDevServer client, and
      // changing JS code would still trigger a refresh.
    ],
    resolve: {
      extensions: [
        ".web.mjs",
        ".mjs",
        ".web.js",
        ".js",
        ".web.ts",
        ".ts",
        ".web.tsx",
        ".tsx",
        ".json",
        ".web.jsx",
        ".jsx",
      ],
    },
    output: {
      // The build folder.
      path: outDir,
      // There will be one main bundle, and one file per asynchronous chunk.
      filename: "index.js",
      // TODO: remove this when upgrading to webpack 5
      futureEmitAssets: true,
      // There are also additional JS chunk files if you use code splitting.
      chunkFilename: "static/js/[name].chunk.js",
      // We inferred the "public path" (such as / or /my-project) from homepage.
      // We use "/" in development.
      publicPath: "/",
      // Prevents conflicts when multiple Webpack runtimes (from different apps)
      // are used on the same page.
      jsonpFunction: `webpackJsonp${appPackageJson.name}`,
    },
    optimization: {
      minimize: false,
      minimizer: [
        // This is only used in production mode
        new TerserPlugin({
          terserOptions: {
            parse: {
              // We want terser to parse ecma 8 code. However, we don't want it
              // to apply any minification steps that turns valid ecma 5 code
              // into invalid ecma 5 code. This is why the "compress" and "output"
              // sections only apply transformations that are ecma 5 safe
              // https://github.com/facebook/create-react-app/pull/4234
              ecma: 8,
            },
            compress: {
              ecma: 5,
              warnings: false,
              // Disabled because of an issue with Uglify breaking seemingly valid code:
              // https://github.com/facebook/create-react-app/issues/2376
              // Pending further investigation:
              // https://github.com/mishoo/UglifyJS2/issues/2011
              comparisons: false,
              // Disabled because of an issue with Terser breaking valid code:
              // https://github.com/facebook/create-react-app/issues/5250
              // Pending further investigation:
              // https://github.com/terser-js/terser/issues/120
              inline: 2,
              // Compressing classnames breaks our RPC mechanism...
              keep_classnames: true,
              keep_fnames: true,
            },
            mangle: {
              safari10: true,
              // Mangling classnames also breaks reflection
              keep_classnames: true,
              keep_fnames: true,
            },
            output: {
              ecma: 5,
              comments: false,
              // Turned on because emoji and regex is not minified properly using default
              // https://github.com/facebook/create-react-app/issues/2488
              ascii_only: true,
            },
          },
          sourceMap: shouldUseSourceMap,
        })
      ],
      // Automatically split vendor and commons
      // https://twitter.com/wSokra/status/969633336732905474
      // https://medium.com/webpack/webpack-4-code-splitting-chunk-graph-and-the-splitchunks-optimization-be739a861366
      splitChunks: false,
      // Keep the runtime chunk separated to enable long term caching
      // https://twitter.com/wSokra/status/969679223278505985
      // https://github.com/facebook/create-react-app/issues/5358
      runtimeChunk: false,
    },
    module: {
      strictExportPresence: true,
      rules: [
        // Disable require.ensure as it's not a standard language feature.
        // { parser: { requireEnsure: false } },
        {
          // "oneOf" will traverse all following loaders until one will
          // match the requirements. When no loader matches it will fall
          // back to the "file" loader at the end of the loader list.
          oneOf: [
            // iModel.js Change: Add support for SVG Sprites.
            {
              test: /\.svg$/,
              resourceQuery: /sprite/,
              use: {
                loader: require.resolve('svg-sprite-loader'),
                options: {
                  symbolId: '[name]-[hash:6]',
                  runtimeCompat: true,
                  spriteFilename: 'sprite-[hash:6].svg',
                },
              },
            },
            // "url" loader works like "file" loader except that it embeds assets
            // smaller than specified limit in bytes as data URLs to avoid requests.
            // A missing `test` is equivalent to a match.
            {
              test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/, /\.svg$/],
              loader: require.resolve("url-loader"),
              options: {
                limit: imageInlineSizeLimit,
                name: "static/media/[name].[hash:8].[ext]",
              },
            },
            // Compile .tsx?
            {
              test: /\.(ts|tsx)$/,
              include: path.dirname(srcFile),
              use: {
                loader: require.resolve("ts-loader"),
                options: {
                  transpileOnly: true,
                  experimentalWatchApi: false,
                  onlyCompileBundledFiles: true,
                  logLevel: "warn",
                  compilerOptions: {
                    declaration: false,
                    declarationMap: false,
                  }
                }
              }
            },
            // "postcss" loader applies autoprefixer to our CSS.
            // "css" loader resolves paths in CSS and adds assets as dependencies.
            // "style" loader turns CSS into JS modules that inject <style> tags.
            // In production, we use MiniCSSExtractPlugin to extract that CSS
            // to a file, but in development "style" loader enables hot editing
            // of CSS.
            // By default we support CSS Modules with the extension .module.css
            {
              test: cssRegex,
              exclude: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: shouldUseSourceMap,
              }),
              // Don't consider CSS imports dead code even if the
              // containing package claims to have no side effects.
              // Remove this when webpack adds a warning or an error for this.
              // See https://github.com/webpack/webpack/issues/6571
              sideEffects: true,
            },
            // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
            // using the extension .module.css
            {
              test: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: shouldUseSourceMap,
                modules: {
                  getLocalIdent: getCSSModuleLocalIdent,
                }
              }),
            },
            // Opt-in support for SASS (using .scss or .sass extensions).
            // By default we support SASS Modules with the
            // extensions .module.scss or .module.sass
            {
              test: sassRegex,
              exclude: sassModuleRegex,
              use: getStyleLoaders(
                {
                  importLoaders: 3,
                  sourceMap: shouldUseSourceMap,
                },
                sassLoaderConfig
              ),
              // Don't consider CSS imports dead code even if the
              // containing package claims to have no side effects.
              // Remove this when webpack adds a warning or an error for this.
              // See https://github.com/webpack/webpack/issues/6571
              sideEffects: true,
            },
            // Adds support for CSS Modules, but using SASS
            // using the extension .module.scss or .module.sass
            {
              test: sassModuleRegex,
              use: getStyleLoaders(
                {
                  importLoaders: 3,
                  sourceMap: shouldUseSourceMap,
                  modules: {
                    getLocalIdent: getCSSModuleLocalIdent,
                  },
                },
                sassLoaderConfig
              ),
            },
            // "file" loader makes sure those assets get served by WebpackDevServer.
            // When you `import` an asset, you get its (virtual) filename.
            // In production, they would get copied to the `build` folder.
            // This loader doesn't use a "test" so it will catch all modules
            // that fall through the other loaders.
            {
              loader: require.resolve("file-loader"),
              // Exclude `js` files to keep "css" loader working as it injects
              // its runtime that would otherwise be processed through "file" loader.
              // Also exclude `html` and `json` extensions so they get processed
              // by webpacks internal loaders.
              exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
              options: {
                name: "static/media/[name].[hash:8].[ext]",
              },
            },
            // ** STOP ** Are you adding a new loader?
            // Make sure to add the new loader(s) before the "file" loader.
          ],
        },
      ],
    },
    plugins: [
      new IModeljsLibraryImportsPlugin(),
      new FrontendDefaultsPlugin(shouldUseSourceMap),
      // new MiniCssExtractPlugin({
      //   // Options similar to the same options in webpackOptions.output
      //   // both options are optional
      //   filename: "static/css/[name].[contenthash:8].css",
      //   chunkFilename: "static/css/[name].[contenthash:8].chunk.css",
      // }),
      // Moment.js is an extremely popular library that bundles large locale files
      // by default due to how Webpack interprets its code. This is a practical
      // solution that requires the user to opt into importing specific locales.
      // https://github.com/jmblog/how-to-optimize-momentjs-with-webpack
      // You can remove this if you don't use Moment.js:
      new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
      // TypeScript type checking
      new ForkTsCheckerWebpackPlugin({
        typescript: require.resolve("typescript"),
        async: false,
        useTypescriptIncrementalApi: true,
        checkSyntacticErrors: true,
        reportFiles: [
          "**",
          "!**/__tests__/**",
          "!**/?(*.)(spec|test).*",
          "!**/src/setupProxy.*",
          "!**/src/setupTests.*",
        ],
        silent: true,
        // The formatter is invoked directly in WebpackDevServerUtils during development
        formatter: typescriptFormatter,
      }),
    ],
    // Some libraries import Node modules but don't use them in the browser.
    // Tell Webpack to provide empty mocks for them so importing them works.
    node: {
      module: "empty",
      dgram: "empty",
      dns: "mock",
      fs: "empty",
      http2: "empty",
      net: "empty",
      tls: "empty",
      child_process: "empty",
    },
    // Turn off performance processing because we utilize
    // our own hints via the FileSizeReporter
    performance: false,
  };

  const config = rawConfig;
  return config;
};
