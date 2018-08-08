/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const chalk = require("chalk");
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");
const { spawnStmux } = require("./utils/tmuxUtils");

exports.command = "start";
exports.describe = chalk.bold("Runs the app in development mode.");
exports.builder = (yargs) =>
  yargs.options({
    "tmux": {
      type: "boolean",
      describe: `(Experimental) Use terminal multiplexing. Requires the "stmux" package to be installed globally.`
    },
  });

exports.handler = async (argv) => {
  const quote = (s) => `"${s}"`;
  const forwardedArgs = process.argv.slice(3);

  const startBackend = quote(["bentley-webpack-tools", "start-backend", ...forwardedArgs].join(" "));
  const startFrontend = quote(["bentley-webpack-tools", "start-frontend", ...forwardedArgs].join(" "));

  if (argv.tmux) {
    spawnStmux([
      "[", startBackend, "..", startFrontend, "]"
    ]);
  } else {
    spawn(require.resolve("concurrently"), [
      "--color", "-k",
      "--names", "B,F",
      startBackend,
      startFrontend,
    ]);
  }
};

// This is required to correctly handle SIGINT on windows.
handleInterrupts();