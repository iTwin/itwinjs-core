#! /usr/bin/env node

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const program = require("commander");
const floss = require("../floss");
const paths = require("@bentley/build-tools/scripts/config/paths");

const isCI = (process.env.TF_BUILD);

const reporterOptions = (isCI) ? {
  reporter: "mocha-junit-reporter",
  reporterOptions: `mochaFile=${paths.appJUnitTestResults}`
} : {
    reporter: "spec"
  };

program
  .version("0.1.0")
  .description("imodeljs-core-testbed")
  .option('-d, --debug', 'Launch electron in debug mode')
  .option('--no-dev-tools', 'Do not automatically open Chrome Developer Tools in debug mode')
  .option('-g, --grep <pattern>', 'only run tests matching <pattern>')
  .option('-f, --fgrep <string>', 'only run tests containing <string>')
  .option('-i, --invert', 'inverts --grep and --fgrep matches')
  .option('-t, --timeout <ms>', 'set test-case timeout in milliseconds [2000]')
  .option('-c, --coverage', 'Generate json coverage report')
  .parse(process.argv);

floss(
  {
    path: "bootstrap.js",
    debug: program.debug,
    timeout: program.timeout || 999999,
    noDevTools: program.noDevTools,
    grep: program.grep,
    fgrep: program.fgrep,
    invert: program.invert,
    coverage: program.coverage,
    checkLeaks: true,
    ...reporterOptions,
  },
  function (returnCode) {
    process.exit(returnCode ? 1 : 0);
  }
);
