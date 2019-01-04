/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "test";
process.env.TEST_ENV = "tsnode";

const isCI = (process.env.TF_BUILD);

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

const inMonoRepo = fs.existsSync(path.join(__dirname, "../../../common/scripts/mocha-reporter-tweaks.js"));
const rushTweaks = (inMonoRepo) ? ["--require", require.resolve("../../../common/scripts/mocha-reporter-tweaks")] : [];

const options = [
  "--check-leaks",
  ...rushTweaks,
  "--require", "source-map-support/register",
  "--require", "ts-node/register",
  "--watch-extensions", "ts",
  "-u", "tdd",
  "--no-cache",
  "--timeout", timeout,
  "--colors"
];

const watchOptions = argv.watch ? ["--watch", "--inline-diffs"] : [];

const reporterOptions = [
  "-R", "spec"
];

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
  ...tscPaths,
  path.resolve(testDir, "**/*.test.ts"),
];

spawn("node", args).then((code) => process.exit(code));
handleInterrupts();
