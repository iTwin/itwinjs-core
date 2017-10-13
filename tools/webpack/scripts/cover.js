/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = "test";
process.env.NODE_ENV = "test";
process.env.MOCHA_ENV = "coverage";

const isCI = (process.env.TF_BUILD);

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

// Ensure environment variables are read.
require("../config/env");

const path = require("path");
const paths = require("../config/paths");

const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

// Some additional options are required for CI builds
const reporterOptions = (!isCI) ? [] : [
  "--reporter=cobertura"
];

// Start the tests
const args = [
  "--reporter=lcov",
  "--reporter=text-summary",
  ...reporterOptions,
  "imodeljs-react-scripts",
  "test",
];
spawn(require.resolve(".bin/nyc"), args).then((code) =>  process.exit(code));
handleInterrupts();