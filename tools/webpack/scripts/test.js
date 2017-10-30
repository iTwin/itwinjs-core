/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = "test";
process.env.NODE_ENV = "test";

const isCoverage = (process.env.MOCHA_ENV === "coverage");
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
const reporterOptions = (!isCI) ? [ "--inline-diffs",  "--colors" ] : [
  "--reporter", "mocha-junit-reporter",
  "--reporter-options", `mochaFile=${paths.appJUnitTestResults}`,
];

const watchOptions = (process.argv.length > 3 && process.argv[3].toLowerCase() === "watch") ? ["--watch"] : [];
const debugOptions = (process.argv.indexOf("--debug") >= 0) ? ["--inspect-brk=41016"] : [];

// Start the tests
const args = [
  ...debugOptions,
  require.resolve("mocha-webpack/lib/cli"),
  "--webpack-config",  require.resolve("../config/webpack.config.test.js"),
  "--require", require.resolve("./utils/testSetup"),
  "--include", require.resolve("./utils/customAssertions"),
  ...watchOptions,  
  ...reporterOptions,
  path.resolve(paths.appTest, "**/*.@(js|jsx|ts|tsx)"),
];

// If we're running coverage, we need to include the app source dir
if (isCoverage)
  args.push(path.resolve(paths.appSrc, "**/*!(.d).@(js|jsx|ts|tsx)"));

spawn("node", args).then((code) =>  process.exit(code));
handleInterrupts();