/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
'use strict';

function init(NODE_ENV, MOCHA_ENV=undefined) {
  process.env.BABEL_ENV = NODE_ENV;
  process.env.NODE_ENV = NODE_ENV;

  if (MOCHA_ENV)
    process.env.MOCHA_ENV = MOCHA_ENV;

  // Set the "CI" environment variable if only "TF_BUILD" is set.
  // We want these to behave exactly the same, but some tools are only looking for "CI".
  if (process.env.TF_BUILD && !process.env.CI)
    process.env.CI = "true";

  global.CONTINUOUS_INTEGRATION = process.env.CI;

  // Makes the script crash on unhandled rejections instead of silently
  // ignoring them. In the future, promise rejections that are not handled will
  // terminate the Node.js process with a non-zero exit code.
  process.on("unhandledRejection", err => {
    throw err;
  });
  
  // Ensure environment variables are read.
  require('../../config/env');
}

module.exports = init;