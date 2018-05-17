/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "prod";

const argv = require("yargs").argv;
const { spawn, spawnSync } = require("./utils/simpleSpawn");

const isCI = (process.env.TF_BUILD);

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

var compileOptions = argv.watch ? ["--watch"] : [];

spawnSync("tsc", compileOptions);

/*
if (argv.release){
  var uglifyOptions = [];

  spawnSync("glob", ["--compress"])
}
*/