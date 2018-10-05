/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const fs = require("fs");
const path = require("path");
const paths = require("./paths");
const configLoader = require("@bentley/config-loader/lib/IModelJsConfig")
const configEnv = configLoader.IModelJsConfig.init(false);
if (configEnv && process.env) {
  Object.assign(process.env, configEnv);
} else {
  console.log("Webpack failed to locate iModelJs configuration");
}
// Make sure that including paths.js after env.js will read .env variables.
delete require.cache[require.resolve("./paths")];

const NODE_ENV = process.env.NODE_ENV;
if (!NODE_ENV) {
  throw new Error(
    "The NODE_ENV environment variable is required but was not specified."
  );
}

// https://github.com/bkeepers/dotenv#what-other-env-files-can-i-use
var dotenvFiles = [
  `${paths.dotenv}.${NODE_ENV}.local`,
  `${paths.dotenv}.${NODE_ENV}`,
  // Don't include `.env.local` for `test` environment
  // since normally you expect tests to produce the same
  // results for everyone
  NODE_ENV !== "test" && `${paths.dotenv}.local`,
  paths.dotenv,
].filter(Boolean);

// Load environment variables from .env* files. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.
// https://github.com/motdotla/dotenv
dotenvFiles.forEach(dotenvFile => {
  if (fs.existsSync(dotenvFile)) {
    require("dotenv").config({
      path: dotenvFile,
    });
  }
});

// We support resolving modules according to `NODE_PATH`.
// This lets you use absolute paths in imports inside large monorepos:
// https://github.com/facebook/create-react-app/issues/253.
// It works similar to `NODE_PATH` in Node itself:
// https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders
// Note that unlike in Node, only *relative* paths from `NODE_PATH` are honored.
// Otherwise, we risk importing Node.js core modules into an app instead of Webpack shims.
// https://github.com/facebook/create-react-app/issues/1023#issuecomment-265344421
// We also resolve them to make sure all tools using them work consistently.
const appDirectory = fs.realpathSync(process.cwd());
process.env.NODE_PATH = (process.env.NODE_PATH || "")
  .split(path.delimiter)
  .filter(folder => folder && !path.isAbsolute(folder))
  .map(folder => path.resolve(appDirectory, folder))
  .join(path.delimiter);

// Grab NODE_ENV and REACT_APP_* environment variables and prepare them to be
// injected into the application via DefinePlugin in Webpack configuration.
const REACT_APP = /^REACT_APP_/i;
// Grab all the imjs_* var for core and test
const IMJS = /^imjs_/i;
function getClientEnvironment(publicUrl) {
  const raw = Object.keys(process.env)
    .filter((key) => { return REACT_APP.test(key) || IMJS.test(key); })
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        // Useful for determining whether we’re running in production mode.
        // Most importantly, it switches React into the correct mode.
        NODE_ENV: process.env.NODE_ENV || "development",
        CORS_PROXY_PORT: process.env.CORS_PROXY_PORT,
        // Useful for resolving the correct path to static assets in `public`.
        // For example, <img src={process.env.PUBLIC_URL + "/img/logo.png"} />.
        // This should only be used as an escape hatch. Normally you would put
        // images into the `src` and `import` them in code to get their paths.
        PUBLIC_URL: publicUrl,
      }
    );

  // Stringify all values so we can feed into Webpack DefinePlugin for frontend builds
  const frontendStringified = {
    "process.env": Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  // On the backend, we still want to use Webpack DefinePlugin to make these
  // compile-time environment variables available (and fixed), but we *also*
  //  want to preserve other run-time environment variables.
  // So we'll use Webpack DefinePlugin to rewrite specific values (i.e., `process.env.NODE_ENV` ===> `"development"`)
  // ***but not*** other instances of `process.env`.
  const backendStringified = Object.keys(raw).reduce((env, key) => {
    env[`process.env.${key}`] = JSON.stringify(raw[key]);
    return env;
  }, {});

  return { raw, frontendStringified, backendStringified };
}

module.exports = getClientEnvironment;
