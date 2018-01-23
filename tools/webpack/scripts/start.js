/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

// Do this as the first thing so that any code reading it knows the right env.
require("./utils/initialize")("development");

const argv = require("yargs").argv;
const chalk = require("chalk");
const config = require("../config/webpack.config.backend");
const { buildBackend }= require("./utils/buildBackend");
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

const debugOptions = (argv.debug) ? ["--inspect-brk=" + argv.debug] : [];
const electronDebugOptions = (argv.electronDebug) ? ["--debug=" + argv.electronDebug] : [];
const electronRemoteDebugOptions = (argv.electronRemoteDebug) ? ["--remote-debugging-port=" + argv.electronRemoteDebug] : [];

(async () => {
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
  spawn("node", [...debugOptions, require.resolve("../scripts/startDevServer.js")]);
  
  // ..and open the electron app.
  if (!argv.noElectron)
    spawn("node", ["node_modules/electron/cli.js", ...electronDebugOptions, ...electronRemoteDebugOptions, "lib/main.js"]);
})();

handleInterrupts();
