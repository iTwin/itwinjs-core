/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const path = require("path");
const webpack = require("webpack");
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CaseSensitivePathsPlugin = require("case-sensitive-paths-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const InterpolateHtmlPlugin = require("react-dev-utils/InterpolateHtmlPlugin");
const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin");
const SpriteLoaderPlugin = require("svg-sprite-loader/plugin");
const getClientEnvironment = require("./env");
const plugins = require("../scripts/utils/webpackPlugins");
const paths = require("./paths");
const helpers = require("./helpers");

// NEEDSWORK: Normally, sass-loader passes a very expensive custom "importer" function as a node-sass option.
// That custom importer tries to hook into webpack's module resolution system, but it's just not worth the
// massive hit to build performance (about 6x slower frontend builds).
// Instead of forking node-sass, I'm just going to add this monkey patch for now:
const backup = require("sass-loader/lib/normalizeOptions");
require.cache[require.resolve("sass-loader/lib/normalizeOptions")] = {
  exports: (...args) => {
    const opts = backup(...args);
    delete opts.importer;
    return opts;
  }
};

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
    output: {
      // The build folder.
      // Next line is not used in dev but WebpackDevServer crashes without it:
      path: paths.appLibPublic,
      // This is the URL that app is served from. We use "/" in development.
      // In production, we inferred the "public path" (such as / or /my-project) from homepage.
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
        // It is guaranteed to exist because we tweak it in `env.js`
        process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
      ),
      // These are the reasonable defaults supported by the Node ecosystem.
      extensions: [
        ".ts",
        ".tsx",
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
        // This is only for FRONTEND code - backend modules should be excluded from the bundle.
        new plugins.BanBackendImportsPlugin(),
      ],
    },
    module: {
      strictExportPresence: true,
      rules: [
        // Disable require.ensure as it's not a standard language feature.
        {
          parser: {
            requireEnsure: false
          }
        },
        {
          test: /\.js$/,
          loader: require.resolve("source-map-loader"),
          enforce: "pre",
          include: helpers.createBentleySourceMapsIncludePaths,
        },
        // "sass" loader compiles SASS into CSS.
        {
          test: /\.scss$/,
          use: {
            loader: require.resolve("sass-loader"),
            options: {
              includePaths: [paths.appNodeModules]
            },
          },
          enforce: "pre",
        },
        {
          // "oneOf" will traverse all following loaders until one will
          // match the requirements. When no loader matches it will fall
          // back to the "file" loader at the end of the loader list.
          oneOf: [
            // Exclude azure-storage (and related packages).
            {
              test: /azure-storage|AzureFileHandler|UrlFileHandler/,
              include: /@bentley[\\\/]imodeljs-clients/,
              loader: require.resolve("null-loader"),
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
            // Compile .tsx?
            {
              test: /\.(ts|tsx)$/,
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
            // Inline SVG icons
            {
              test: /\.svg$/,
              issuer: {
                exclude: /\.css$/
              },
              use: [{
                loader: require.resolve("svg-sprite-loader"),
                options: {
                  runtimeCompat: true,
                  spriteFilename: "sprite-[hash:6].svg"
                },
              }]
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
          ]
        }
        // ** STOP ** Are you adding a new loader?
        // Make sure to add the new loader(s) before the "file" loader.
      ],
    },

    // Some libraries import Node modules but don't use them in the browser.
    // Tell Webpack to provide empty mocks for them so importing them works.
    node: {
      dgram: "empty",
      fs: "empty",
      net: "empty",
      tls: "empty"
    },

    optimization: {
      // Automatically split vendor and commons
      // https://twitter.com/wSokra/status/969633336732905474
      splitChunks: {
        chunks: 'all',
      },
      // Keep the runtime chunk seperated to enable long term caching
      // https://twitter.com/wSokra/status/969679223278505985
      runtimeChunk: true,
    },

    // There are a number of plugins that are common to both configs
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        tsconfig: paths.appTsConfig,
        tslint: paths.appTsLint,
        async: false,
        silent: true,
      }),
      new plugins.CopyBentleyStaticResourcesPlugin(["public"]),
      // Generates an `index.html` file with the <script> injected.
      // This _should_ be specified in the separate dev and prod configs, but it's here because it has to be added _before_ InterpolateHtmlPlugin
      new HtmlWebpackPlugin({
        inject: true,
        template: paths.appHtml,
        minify: (process.env.NODE_ENV === "development") ? undefined : {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        },
      }),
      // Makes some environment variables available in index.html.
      // The public URL is available as %PUBLIC_URL% in index.html, e.g.:
      // <link rel="shortcut icon" href="%PUBLIC_URL%/favicon.ico">
      // In development, this will be an empty string.
      // In production, it will be an empty string unless you specify "homepage"
      // in `package.json`, in which case it will be the pathname of that URL.
      new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
      // Makes some environment variables available to the JS code, for example:
      // if (process.env.NODE_ENV === "development") { ... }. See `./env.js`.
      // For a PRODUCTION build, it is absolutely essential that NODE_ENV was set to production here.
      // Otherwise React will be compiled in the very slow development mode.
      new webpack.DefinePlugin(env.frontendStringified),
      // Watcher doesn't work well if you mistype casing in a path so we use
      // a plugin that prints an error when you attempt to do this.
      // See https://github.com/facebookincubator/create-react-app/issues/240
      new CaseSensitivePathsPlugin(),
      // Moment.js is an extremely popular library that bundles large locale files
      // by default due to how Webpack interprets its code. This is a practical
      // solution that requires the user to opt into importing specific locales.
      // https://github.com/jmblog/how-to-optimize-momentjs-with-webpack
      // You can remove this if you don't use Moment.js:
      new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
      new SpriteLoaderPlugin(),
      // Automatically make React available
      new webpack.ProvidePlugin({
        React: "react",
      }),
    ],

    performance: {
      maxEntrypointSize: 5000000,
      maxAssetSize: 5000000,
    }
  };
};