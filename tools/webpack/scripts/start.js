/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
'use strict';

// Do this as the first thing so that any code reading it knows the right env.
require("./utils/initialize")("development");

const chalk = require('chalk');
const config = require('../config/webpack.config.backend');
const buildBackend = require('./utils/buildBackend');
const { spawn, handleInterrupts } = require('./utils/simpleSpawn');

(async () => {
  // Compile the backend bundle first.
  console.log();
  const backendStartTime = Date.now();
  console.log(`${chalk.inverse(" BACKEND ")} Starting development build...`);
  await buildBackend(config);
  const elapsed = Date.now() - backendStartTime;
  console.log(`${chalk.inverse(" BACKEND ")} Build completed successfully in ${chalk.green(elapsed + "ms")}`);
  
  // Now start the devserver...
  console.log();
  console.log(`${chalk.inverse(" FRONTEND ")} Starting development build...`);
  spawn('node', [require.resolve('../scripts/startDevServer.js')]);
  
  // ..and open the electron app.
  spawn('node', ['node_modules/electron/cli.js', 'lib/main.js']);
})();

handleInterrupts();
