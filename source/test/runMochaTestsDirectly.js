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
//require("./Category.test.js");
//require("./ECSqlStatement.test.js");
require("./ClassRegistry.test.js");
mocha.run();