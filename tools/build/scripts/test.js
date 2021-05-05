/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "test";

const isCoverage = (process.env.MOCHA_ENV === "coverage");

const paths = require("./config/paths");
const path = require("path");
const {
  spawn,
  handleInterrupts
} = require("./utils/simpleSpawn");
const argv = require("yargs").argv;

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

const packageRoot = (argv.packageRoot !== undefined) ? argv.packageRoot : process.cwd();
const testDir = (argv.testDir !== undefined) ? argv.testDir : paths.appLibTests;
const timeout = (argv.timeout !== undefined) ? argv.timeout : "999999";
const defineWindow = argv.defineWindow !== undefined;

const options = [
  "--check-leaks",
  "--require", "source-map-support/register",
  "--watch-extensions", "ts",
  "-u", "bdd",
  "--colors",
  "--timeout", timeout,
  "--reporter", require.resolve("../mocha-reporter"),
  "--reporter-options", `mochaFile=${paths.appJUnitTestResults}`,
];

if (defineWindow)
  options.push("--require", "jsdom-global/register");

const offlineOptions = [];
if (argv.offline === "mock")
  offlineOptions.push("--offline", "mock");

const watchOptions = argv.watch ? ["--watch", "--inline-diffs"] : [];

const debugOptions = argv.debug || argv.inspect ? [
  "--inspect=9229"
] : [];

let grepOptions = [];
if (undefined !== argv.grep) {
  grepOptions = ["--grep", argv.grep];
  if (undefined !== argv.invert)
    grepOptions.push("--invert");
}

const args = [
  ...debugOptions,
  path.resolve(packageRoot, "node_modules/mocha/bin/_mocha"),
  ...watchOptions,
  ...options,
  ...grepOptions,
  ...offlineOptions,
  path.resolve(testDir, "**/*.test.js"),
];

if (isCoverage)
  args.push(path.resolve(paths.appSrc, "**/*!(.d).ts"));

if (undefined !== argv.opts)
  args.push(argv.opts);

const checkOnline = async () => {
  return new Promise((resolve) => {
    if (argv.offline !== "skip") {
      resolve(true);
      return;
    }
    require('dns').lookup("www.bentley.com", (err) => {
      resolve(!err);
    });
  });
};

checkOnline()
  .then((doTests) => {
    if (doTests) {
      return spawn("node", args);
    } else {
      console.log("Detected offline run. Skipping tests in " + path.resolve(argv.testDir));
      return 0;
    }
  })
  .then((code) => process.exit(code));

handleInterrupts();
