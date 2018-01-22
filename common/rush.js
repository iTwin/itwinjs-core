/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
'use strict';
const path = require('path');

// note: to run Rush on a CI server we need to invoke it in a npm context - this script 
// in addition to npm scripts defined in the root package.json takes care of that
require(path.resolve(process.env.npm_config_prefix, "node_modules/@microsoft/rush/lib/start.js"));