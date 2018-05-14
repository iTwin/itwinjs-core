/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const chalk = require("chalk");
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

exports.command = "start";
exports.describe = chalk.bold("Runs the app in development mode.");

exports.handler = async (argv) => {
  const quote = (s) => `"${s}"`;
  const forwardedArgs = argv._.slice(1);

  const startBackend = quote(["imodeljs-react-scripts", "start-backend", ...forwardedArgs].join(" "));
  const startFrontend = quote(["imodeljs-react-scripts", "start-frontend", ...forwardedArgs].join(" "));

  spawn(require.resolve("concurrently"), [
    "--color", "-k",
    "--names", "B,F",
    startBackend,
    startFrontend,
  ]);
};

// This is required to correctly handle SIGINT on windows.
handleInterrupts();