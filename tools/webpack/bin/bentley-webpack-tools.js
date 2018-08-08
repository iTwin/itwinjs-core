#!/usr/bin/env node
"use strict";

require('yargonaut')
  .style('green')
  .style('yellow', "required")
  .style('cyan', "Positionals:")
  .helpStyle('cyan')
  .errorsStyle('red.bold');

const chalk = require("chalk");
const yargs = require("yargs");
const argv = yargs
  .wrap(Math.min(120, yargs.terminalWidth()))
  .usage(`\n${chalk.bold("$0")} ${chalk.yellow("<command>")}`)
  .command(require("../scripts/start"))
  .command(require("../scripts/start-backend"))
  .command(require("../scripts/start-frontend"))
  .command(require("../scripts/test"))
  .command(require("../scripts/test-e2e"))
  .command(require("../scripts/cover"))
  .command(require("../scripts/build"))
  .epilogue(`${chalk.cyan("For more information on a particular command, run:")}\n\n    ${chalk.bold("bentley-webpack-tools")} ${chalk.yellow("<command>")} ${chalk.green("--help")}`)
  .argv;
