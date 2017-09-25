/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = "test";
process.env.NODE_ENV = "test";

const isCoverage = (process.env.MOCHA_ENV === "coverage");
let isCI = (process.env.CONTINUOUS_INTEGRATION);

if (isCI) {
  console.log("=========== THIS IS A CONTINUOUS INTEGRATION BUILD ===========");
}
isCI=true;

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
  "--reporter", "mocha-junit-reporter",
  "--reporter-options", `mochaFile=${paths.appJUnitTestResults}`,
];

// Start the tests
const args = [
  "--webpack-config",  require.resolve("../config/webpack.config.test.js"),
  "--require", require.resolve("./utils/testSetup"),
  ...reporterOptions,
  path.resolve(paths.appTest, "**/*.@(js|jsx|ts|tsx)"),
];

// If we"re running coverage, we need to include the app source dir
if (isCoverage)
  args.push(path.resolve(paths.appSrc, "**/*!(.d).@(js|jsx|ts|tsx)"));

spawn(path.resolve(__dirname, "../node_modules/.bin/mocha-webpack"), args).then((code) =>  process.exit(code));
handleInterrupts();