/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const chalk = require("chalk");
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

exports.command = "start-backend";
exports.describe = chalk.bold("Runs the app's backend in development mode. Should be run in parallel with start-frontend.");
exports.builder = (yargs) =>
  yargs.options({
    "debug": {
      type: "string",
      describe: `The port for the web backend to listen on for (inspector) debugging.`
    },
  })
    .options({
      "electronDebug": {
        type: "string",
        describe: `The port for the electron main process to listen on for (inspector) debugging.`
      },
    })
    .options({
      "electronRemoteDebug": {
        type: "string",
        describe: `The port for the electron render process to listen on for (chrome) debugging.`
      },
    })
    .options({
      "noElectron": {
        type: "boolean",
        describe: `Don't start the electron app.`
      },
    })
    .options({
      "noWeb": {
        type: "boolean",
        describe: `Don't start the web backend.`
      },
    })
    .options({
      "configLoader": {
        type: "boolean",
        default: "false",
        describe: "Use auto locate imodel.js config folder",
      },
    });

exports.handler = async (argv) => {
  process.env.IMODELJS_CONFIG_LOADER = argv.configLoader ? true : false;

  // Do this as the first thing so that any code reading it knows the right env.
  require("./utils/initialize")("development");
  const paths = require("../config/paths");
  const config = require("../config/webpack.config.backend.dev");
  const { watchBackend } = require("./utils/webpackWrappers");

  const nodeDebugOptions = (argv.debug) ? ["--inspect-brk=" + argv.debug] : [];
  const electronDebugOptions = (argv.electronDebug) ? ["--inspect-brk=" + argv.electronDebug] : [];
  const electronRemoteDebugOptions = (argv.electronRemoteDebug) ? ["--remote-debugging-port=" + argv.electronRemoteDebug] : [];

  // Run a webpack watch to compile/re-compile the backend bundle.
  await watchBackend(config); // Resolves on first successful build.
  const args = [];
  const names = [];
  const colors = [];
  const quote = (s) => `"${s}"`;

  if (!argv.noWeb) {
    args.push(["node", require.resolve("nodemon/bin/nodemon"), "--no-colors", "--watch", paths.appBuiltMainJs, ...nodeDebugOptions, paths.appBuiltMainJs]);
    names.push("web-serv");
    colors.push("cyan");
  }

  if (!argv.noElectron) {
    args.push(["node", require.resolve("nodemon/bin/nodemon"), "--no-colors", "--watch", paths.appBuiltMainJs, "node_modules/electron/cli.js", ...electronDebugOptions, ...electronRemoteDebugOptions, paths.appBuiltMainJs]);
    names.push("electron");
    colors.push("magenta");
  }

  if (args.length > 0) {
    spawn(require.resolve("concurrently"), [
      ...args.map((a) => quote(a.join(" "))),
      "--color", "-c", colors.join(","),
      "--names", names.join(",")
    ]);
  }
};

// This is required to correctly handle SIGINT on windows.
handleInterrupts();