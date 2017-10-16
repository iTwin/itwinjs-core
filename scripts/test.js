/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "test";

const isCoverage = (process.env.MOCHA_ENV === "coverage");
const isCI = (process.env.TF_BUILD);

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

const options = [
  "-t", "20000",
  "--check-leaks",
  "--require", "source-map-support/register",
  "--compilers", "ts-node/register",
  "--watch-extensions", "ts",
  "--colors"
]

const reporterOptions = (!isCI) ? [
  "-R", "spec"
]: [
  "--reporter", "mocha-junit-reporter",
  "--reporter-options", `mochaFile=${paths.appJUnitTestResults}`,
]

const watchOptions = (process.argv[process.argv.length-1].toLowerCase() === "watch") ? ["--watch", "--inline-diffs"] : [];

const paths = require("./config/paths");
const path = require("path");

const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

// Needed for ts_node to honor the tsconfig at the root of the project
process.env.TS_NODE_PROJECT = paths.appRoot;

const args = [
  ...watchOptions,
  ...reporterOptions,
  ...options,
  path.resolve(paths.appTest, "**/*.test.ts"),
];

if (isCoverage)
  args.push(path.resolve(paths.appSrc, "**/*!(.d).ts)"));

spawn(path.resolve(__dirname, "../node_modules/.bin/_mocha"), args).then((code) =>  process.exit(code));
handleInterrupts();
