/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "test";

const isCoverage = (process.env.MOCHA_ENV === "coverage");
const isCI = (process.env.TF_BUILD);

const paths = require("./config/paths");
const path = require("path");
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");
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

const options = [
  "--check-leaks",
  "--require", "source-map-support/register",
  "--watch-extensions", "ts",
  "-u", "tdd",
  "--timeout", timeout,
  "--colors"
];

const offlineOptions = [];
if (argv.offline === "mock") {
  offlineOptions.push("--offline", "mock");
}

const watchOptions = argv.watch ? ["--watch", "--inline-diffs"] : [];

const reporterOptions = (!isCI) ? [
  "-R", "spec"
] : [
    "--reporter", "mocha-junit-reporter",
    "--reporter-options", `mochaFile=${paths.appJUnitTestResults}`,
  ]

const debugOptions = argv.debug ?
  [
    "--inspect=9229",
    "--debug-brk"
  ] : []

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
  ...reporterOptions,
  ...options,
  ...grepOptions,
  ...offlineOptions,
  path.resolve(testDir, "**/*.test.js"),
];

if (isCoverage)
  args.push(path.resolve(paths.appSrc, "**/*!(.d).ts"));

const checkOnline = async () => {
  return new Promise((resolve) => {
    if (argv.offline !== "skip") {
      resolve(true);
      return;
    }
    require('dns').lookup("qa-connect-webportal.bentley.com", (err) => {
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
