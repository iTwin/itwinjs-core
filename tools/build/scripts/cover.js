/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "test";
process.env.MOCHA_ENV = "coverage";

const isCI = (process.env.TF_BUILD);

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

const path = require("path");
const paths = require("./config/paths");
const argv = require("yargs").argv;
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

const testCommand = (argv.testCommand === undefined) ? "test:tsnode" : argv.testCommand;

// Some additional options are required for CI builds
const reporterOptions = (!isCI) ? [
  "--reporter=text-summary",
] : [
  "--reporter=cobertura"
];

// Start the tests
const args = [
  ...reporterOptions,
  "npm", "run", testCommand,
];

spawn(path.resolve(__dirname, "../node_modules/.bin/nyc"), args).then((code) =>  process.exit(code));
handleInterrupts();
