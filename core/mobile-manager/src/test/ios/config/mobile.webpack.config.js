/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const webpack = require("webpack");
const fs = require("fs");

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

// 'is_ci_job' variable is set in ci job env. CI job already set all the environment variable required to run integration test
if (!process.env.TF_BUILD) {
  loadEnv(path.join(__dirname, "..", "..", ".env"));
}

/** Find package root folder where package.json exist */
function findPackageRootDir(dir = __dirname) {
  if (!fs.existsSync(dir))
    return undefined;

  for (const entry of fs.readdirSync(dir)) {
    if (entry === "package.json") {
      return dir;
    }
  }
  return findPackageRootDir(path.join(dir, ".."));
}
const outputDir = path.resolve(findPackageRootDir(), "lib/test/ios/webpack");
const configFile = path.join(outputDir, "config.json");
const filteredEnv = Object.keys(process.env)
  .filter(key => key.match(/^imjs_|^hybrid_test_|^saml_delegation_test_/i))
  .reduce((obj, key) => {
    obj[key] = process.env[key];
    return obj;
  }, {});

fs.writeFileSync(configFile, JSON.stringify(filteredEnv, undefined, 2));
module.exports = {
  mode: "development",
  entry: "./lib/test/runMochaTestsDirectly.js",
  output: {
    path: outputDir,
    filename: "runMochaTestsDirectly.js",
    libraryTarget: "commonjs2",
  },
  target: "webworker",
  devtool: "source-map",
  module: {
    rules: [{
      test: /growl\.js$/,
      use: 'null-loader'
    },
    {
      test: /xunit\.js$/,
      use: 'null-loader'
    },
    {
      test: /bunyan/,
      use: 'null-loader'
    },
    {
      test: /@azure/,
      use: 'null-loader'
    },
    {
      test: /IModelBankCloudEnv\.js$/,
      use: 'null-loader'
    },
    {
      test: /DevTools\.js$/,
      use: 'null-loader'
    },
    {
      test: /OidcDesktopClient\.js$/,
      use: 'null-loader'
    },
    {
      test: /oidc-signin-tool/,
      use: 'null-loader'
    },
    {
      test: /AzCopy\.js$/,
      use: 'null-loader'
    },
    ]
  },
  node: {
    process: false
  },
  externals: {
    "@bentley/imodeljs-native/package.json": "@bentley/imodeljs-native/package.json",
    "electron": "electron",
    "IModelJsFs": "IModelJsFs",
    "./IModelJsFs": "IModelJsFs",
    "../IModelJsFs": "IModelJsFs",
    "../../IModelJsFs": "IModelJsFs",
    "./lib/IModelJsFs.js": "IModelJsFs",
    "fs": "fs",
    "fs-extra": "fs",
    "express": "express",
  },
  stats: {
    warnings: false
  },
  plugins: [
    new webpack.DefinePlugin({ "global.location.search": "''" }),
    new webpack.ProvidePlugin({}),
    new webpack.EnvironmentPlugin({})
  ],
}