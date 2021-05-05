/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "test";
process.env.TEST_ENV = "tsnode";

const paths = require("./config/paths");
const path = require("path");
const fs = require("fs");
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");
const argv = require("yargs").argv;

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

const packageRoot = (argv.packageRoot !== undefined) ? argv.packageRoot : process.cwd();
const testDir = (argv.testDir !== undefined) ? argv.testDir : paths.appTest;
const timeout = (argv.timeout !== undefined) ? argv.timeout : "999999";

const tscPaths = argv.tscPaths ? ["--require", "tsconfig-paths/register"] : [];

const options = [
  "--check-leaks",
  "--require", "source-map-support/register",
  "--require", "ts-node/register",
  "--watch-extensions", "ts",
  "-u", "bdd",
  "--no-cache",
  "--timeout", timeout,
  "--colors",
  "--reporter", require.resolve("../mocha-reporter"),
  "--reporter-options", `mochaFile=${paths.appJUnitTestResults}`,
];

const watchOptions = argv.watch ? ["--watch", "--inline-diffs"] : [];

const debugOptions = argv.debug || argv.inspect ? [
  "--inspect=9229"
] : [];

let grepOptions = [];
if (argv.grep) {
  grepOptions = ["--grep", argv.grep];
  if (argv.invert) {
    grepOptions.push("--invert");
  }
}

const args = [
  ...debugOptions,
  path.resolve(packageRoot, "node_modules/mocha/bin/_mocha"),
  ...watchOptions,
  ...options,
  ...grepOptions,
  ...tscPaths,
  path.resolve(testDir, "**/*.test.ts"),
];

spawn("node", args).then((code) => process.exit(code));
handleInterrupts();
