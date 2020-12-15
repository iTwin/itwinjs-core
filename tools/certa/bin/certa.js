#!/usr/bin/env node

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

"use strict";

const yargs = require("yargs");
yargs.strict(true)
  .wrap(Math.min(150, yargs.terminalWidth()))
  .options({
    "runner": {
      alias: "r",
      choices: ["electron", "chrome", "node"],
      describe: `The target test runner environment.`,
      type: "string",
      demandOption: true,
    },
    "backend": {
      alias: "b",
      describe: `The path to a javascript file containing backend initialization logic.`,
      type: "string"
    },
    "config": {
      alias: "c",
      describe: `Path to a certa.json config file.`,
      type: "string",
      default: "./certa.json"
    },
    "cover": {
      describe: `Measure code coverage using nyc.`,
      type: "boolean",
      default: undefined
    },
    "debug": {
      describe: `Run in debug mode.`,
      type: "boolean",
      default: undefined
    },
    "testBundle": {
      alias: "t",
      describe: `The path to a javascript file containing all mocha tests to be run.`,
      type: "string"
    },
    "grep": {
      alias: "g",
      requiresArg: "pattern",
      describe: `Only run tests matching <pattern>`,
      type: "string",
    },
    "fgrep": {
      alias: "f",
      requiresArg: "string",
      describe: `Only run tests containing <string>`,
      type: "string",
    },
    "invert": {
      alias: "i",
      describe: `Inverts --grep and --fgrep matches`,
      type: "boolean",
      default: undefined,
    },
  });

const path = require("path");
const fs = require("fs");
const { certa } = require("../lib/CertaCore");
const { CertaConfig } = require("../lib/CertaConfig");

const opts = {
  debug: yargs.argv.debug,
  cover: yargs.argv.cover,
  testBundle: yargs.argv.testBundle,
  backendInitModule: yargs.argv.backend,
  mochaOptions: {
    grep: yargs.argv.grep,
    fgrep: yargs.argv.fgrep,
    invert: yargs.argv.invert,
  }
};

const configFilePath = path.resolve(process.cwd(), yargs.argv.config);
let config;
if (fs.existsSync(configFilePath))
  config = CertaConfig.fromConfigFile(configFilePath, opts);
else
  config = CertaConfig.fromObject(opts);

(async () => {
  try {
    await certa(yargs.argv.runner, config);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      console.error(error.stack);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
})();
