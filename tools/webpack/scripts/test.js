/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const chalk = require("chalk");

exports.command = "test";
exports.describe = chalk.bold("Launches the test runner.");
exports.builder = (yargs) =>
  yargs.options({
    "debug": {
      type: "string",
      describe: `The port to listen on for (inspector) debugging.`
    },
    "watch": {
      alias: "w",
      type: "boolean",
      describe: `Start the tests in interactive watch mode.`
    },
    "updateSnapshot": {
      alias: "u",
      type: "boolean",
      describe: `Use this flag to re-record every snapshot that fails during this test run.`
    },
    "include": {
      alias: "i",
      type: "string",
      describe: `An additional file to include with every test run. Useful for specifying global mocha hooks.`
    },
    "subdirectory": {
      alias: "s",
      type: "string",
      describe: `Limits the test run to tests defined in a given test subdirectory.`
    },
    "exclude": {
      alias: "x",
      type: "string",
      describe: `Exclude all tests defined in a given test subdirectory.`
    },
  });

exports.handler = (argv) => {

  // Do this as the first thing so that any code reading it knows the right env.
  require("./utils/initialize")("test");
  const isCoverage = (process.env.MOCHA_ENV === "coverage");

  const path = require("path");
  const paths = require("../config/paths");
  const { spawn, handleInterrupts } = require("./utils/simpleSpawn");


  // Support jest-style args for updating all snapshots
  if (argv.updateSnapshot || argv.u)
    process.env.CHAI_JEST_SNAPSHOT_UPDATE_ALL = "true";

  // Some additional options are required for CI builds
  let reporterOptions = [ "--inline-diffs",  "--colors" ];
  if (CONTINUOUS_INTEGRATION) {
    const reportDir = (argv.subdirectory) ? path.join(paths.appTestResults, argv.subdirectory) : paths.appTestResults;
    const appJUnitTestResults = path.resolve(reportDir, "junit_results.xml");

    reporterOptions = [
      "--reporter", "mocha-junit-reporter",
      "--reporter-options", `mochaFile=${appJUnitTestResults}`,
    ];
  }

  const watchOptions = (!CONTINUOUS_INTEGRATION && argv.watch) ? ["--watch", "--interactive"] : [];
  const debugOptions = (argv.debug) ? ["--inspect-brk=" + argv.debug] : [];
  const includeOptions = (argv.include) ? ["--include", argv.include] : [];

  const webpackConfig = require.resolve(`../config/webpack.config.${(isCoverage) ? "coverage" : "test" }.js`);
  const testDir = (argv.subdirectory) ? path.join(paths.appTest, argv.subdirectory) : paths.appTest;
  const excluded = (argv.exclude) ? `{,!(${argv.exclude})/**/}` : "**/";

  // Start the tests
  const args = [
    ...debugOptions,
    require.resolve("mocha-webpack/lib/cli"),
    "--webpack-config",  webpackConfig,
    "--require", require.resolve("./utils/jsdomSetup"),
    "--include", require.resolve("./utils/testSetup"),
    ...includeOptions,
    ...watchOptions,
    ...reporterOptions,
    path.resolve(testDir, excluded + "*.@(js|jsx|ts|tsx)"),
  ];

  // If we're running coverage, we need to include the app source dir
  if (isCoverage) {
    args.push(path.resolve(paths.appSrc, "**/*!(.d).@(js|jsx|ts|tsx)"));
  }

  spawn("node", args).then((code) =>  process.exit(code));
  handleInterrupts();
};
