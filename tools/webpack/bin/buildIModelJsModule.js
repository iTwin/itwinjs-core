#!/usr/bin/env node
"use strict";

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const yargs = require("yargs");
yargs.wrap(120)
  .options({
    "production": {
      alias: ["prod", "p"],
      describe: "Build production version of module",
      default: false,
      type: "boolean"
    },
    "verbose": {
      alias: ["v"],
      describe: "Sets a detail level of 1.",
      default: false,
      type: "boolean"
    },
    "detail": {
      alias: "d",
      options: [0, 1, 2, 3, 4, 5],
      type: "number",
      default: 0,
      describe: "Sets detail level (0 to 5) to reveal more about the build process. Overrides the '--verbose' option if it's provided."
    },
    "stats": {
      alias: "s",
      type: "boolean",
      default: false,
      describe: "Creates the webpack stats json file for system modules."
    },
  }).help();

const { validPackageJsonConfig, fromPackageJson } = require("../lib/IModelJsModuleOptions");
const { main } = require("../lib/BuildModule");

const opts = {
  detail: yargs.argv.verbose ? 1 : yargs.argv.detail,
};

if (opts.detail > 0)
  console.log("Command line args: " + JSON.stringify(opts));

let config; // Should be of type IModelJsModuleConfig
if (validPackageJsonConfig(process.cwd())) {
  // read the contents of the package json file to get the config
  config = fromPackageJson(process.cwd(), opts);
  // console.log(JSON.stringify(config));
} else
  process.exit(1);

(async () => {
  let exitCode;
  try {
    exitCode = await main(config, !yargs.argv.production, yargs.argv.stats);
  } catch (error) {
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
  process.exit(exitCode);
})();
