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
        console_log("pass: " + test.fullTitle());
    });
    runner.on('fail', function (test, err) {
        failures++;
        console_log("fail: " + test.fullTitle() + " -- error: " + err.message);
    });
    runner.on('end', function () {
        console_log("end: " + passes + " / " + (passes+failures));
        // process.exit(failures);
    });
}
mocha.setup({ui: 'bdd', reporter: mobileReporter}); // puts 'describe', 'it', etc. into global
debugger;
require("./IModelTestUtils.js");
// Passing tests:
require("./Category.test.js");
require("./ECSqlStatement.test.js");
require("./ClassRegistry.test.js");
require("./ECDb.test.js");
require("./ElementAspect.test.js");
require("./GeometryStream.test.js");
require("./IModel.test.js");
require("./Promise.test.js");
require("./Render.test.js");
require("./ViewState.test.js");


// Nothing that needs XHR will work
// require("./BriefcaseManager.test.js");
// require("./ChangeSummary.test.js");
// require("./IModelConnection.test.js");
// require("./SampleCode.test.js");
mocha.run();