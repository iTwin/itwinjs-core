/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

"use strict";

// Run selected backend mocha tests programmatically. We do this in the mobile platform.
require("mocha"); // puts the symbol "mocha" in global.
require("chai"); // puts 'assert', etc. into global
function mobileReporter(runner) {
    Mocha.reporters.Base.call(this, runner);
    var passes = 0;
    var failures = 0;
    runner.on('pass', function (test) {
        passes++;
        console_log("pass: " + test.fullTitle() + "\n");
    });
    runner.on('fail', function (test, err) {
        failures++;
        console_log("fail: " + test.fullTitle() + " -- error: " + err.message + "\n");
    });
    runner.on('end', function () {
        console_log("end: " + passes + " / " + (passes+failures) + "\n");
        // process.exit(failures);
    });
}
mocha.setup({ui: 'bdd', reporter: mobileReporter}); // puts 'describe', 'it', etc. into global
debugger;
require("./IModelTestUtils.js");
// Passing tests:
require("./standalone/Category.test.js");
require("./standalone/ECSqlStatement.test.js");
require("./standalone/ClassRegistry.test.js");
require("./standalone/ECDb.test.js");
require("./standalone/ElementAspect.test.js");
require("./standalone/GeometryStream.test.js");
require("./standalone/IModel.test.js");
require("./Promise.test.js");
require("./Render.test.js");


// Nothing that needs XHR will work
// require("./BriefcaseManager.test.js");
// require("./ChangeSummary.test.js");
// require("./IModelConnection.test.js");
// require("./SampleCode.test.js");
mocha.run();