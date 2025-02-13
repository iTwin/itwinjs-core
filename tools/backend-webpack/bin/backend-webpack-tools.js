#!/usr/bin/env node

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

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
  .showHelpOnFail(false)
  .wrap(Math.min(120, yargs.terminalWidth()))
  .usage(`\n${chalk.bold("$0")} ${chalk.yellow("<command>")}`)
  .command(require("../scripts/start"))
  .command(require("../scripts/build"))
  .epilogue(`${chalk.cyan("For more information on a particular command, run:")}\n\n    ${chalk.bold("backend-webpack-tools")} ${chalk.yellow("<command>")} ${chalk.green("--help")}`)
  .argv;
