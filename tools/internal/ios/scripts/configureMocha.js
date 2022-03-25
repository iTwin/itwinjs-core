/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

var Mocha = require("mocha/lib/mocha");
global.mocha = new Mocha();

const BentleyMochaReporter = require("@itwin/build-tools/mocha-reporter");

mocha.ui("bdd");
mocha.suite.emit("pre-require", global, null, mocha);
mocha.timeout(9999999);
mocha.reporter(BentleyMochaReporter, { mochaFile: process.env.TEST_RESULTS_PATH });