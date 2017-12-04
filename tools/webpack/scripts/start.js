/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// Ensure environment variables are read.
require('../config/env');

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
  spawn('node_modules/.bin/electron', ['lib/main.js']);
})();

handleInterrupts();
