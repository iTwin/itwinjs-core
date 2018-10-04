/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const path = require("path");
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

  const bentleyWebpackToolsPath = path.resolve(__dirname, "..", "bin", "bentley-webpack-tools.js");
  const startBackend = quote(["node", bentleyWebpackToolsPath, "start-backend", ...forwardedArgs].join(" "));
  const startFrontend = quote(["node", bentleyWebpackToolsPath, "start-frontend", ...forwardedArgs].join(" "));

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