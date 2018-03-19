/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const chalk = require("chalk");

exports.command = "start";
exports.describe = chalk.bold("Runs the app in development mode.");
exports.builder = (yargs) =>
  yargs.options({
    "debug": {
      type: "string",
      describe: `The port for the dev server to listen on for (inspector) debugging.`
    },
  })
  .options({
    "electronDebug": {
      type: "string",
      describe: `The port for the electron main process to listen on for (legacy) debugging.`
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
  });

exports.handler = async (argv) => {

  // Do this as the first thing so that any code reading it knows the right env.
  require("./utils/initialize")("development");

  const config = require("../config/webpack.config.backend.dev");
  const { buildBackend }= require("./utils/buildBackend");
  const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

  const electronDebugOptions = (argv.electronDebug) ? ["--debug=" + argv.electronDebug] : [];
  const electronRemoteDebugOptions = (argv.electronRemoteDebug) ? ["--remote-debugging-port=" + argv.electronRemoteDebug] : [];

  // Compile the backend bundle first.
  console.log();
  const backendStartTime = Date.now();
  console.log(`${chalk.inverse(" BACKEND ")} Starting development build...`);
  await buildBackend(config);
  const elapsed = Date.now() - backendStartTime;
  console.log(`${chalk.inverse(" BACKEND ")} Build completed successfully in ${chalk.green(elapsed + "ms")}`);

  // Start the CORS proxy server before starting the frontend
  spawn("node", [require.resolve("@bentley/dev-cors-proxy-server/server.js")], undefined, {PORT: process.env.CORS_PROXY_PORT});

  // Now start the devserver...
  console.log();
  console.log(`${chalk.inverse(" FRONTEND ")} Starting development build...`);
  await require("../scripts/startDevServer.js")();

  // ..and open the electron app.
  if (!argv.noElectron)
    spawn("node", ["node_modules/electron/cli.js", ...electronDebugOptions, ...electronRemoteDebugOptions, "lib/main.js"]);

  handleInterrupts();
};