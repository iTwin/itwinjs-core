/*---------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/

"use strict";

// Run selected backend mocha tests programmatically. We do this in the mobile platform.
require("mocha"); // puts the symbol "mocha" in global.
require("chai"); // puts 'assert', etc. into global
const config = require("@bentley/imodeljs-clients").Config;
config.App.merge(
    eval('require("./config.json");')
);
function mobileReporter(runner) {
    Mocha.reporters.Base.call(this, runner);
    var stats = { suites: 0, tests: 0, passes: 0, pending: 0, failures: 0 };
    var indents = 1;
    runner.stats = stats;
    function indent() {
        return Array(indents).join('  ');
    }
    runner.on('suite', function (suite) {
        stats.suites = stats.suites || 0;
        if (suite.root) return;
        stats.suites++;
        process.mocha_log("MOCHA", `\n${indent()} λ ${suite.title}`);
        indents++;
    });
    runner.on('suite end', function (suite) {
        indents--;
    });
    runner.on('pending', function () {
        stats.pending++;
    });
    runner.on('test', function (test) {
        console.log('Running test:', test.title);
    });
    runner.on('pass', function (test) {
        stats.passes = stats.passes || 0;
        var medium = test.slow() / 2;
        test.speed =
            test.duration > test.slow()
                ? 'slow'
                : test.duration > medium ? 'medium' : 'fast';
        stats.passes++;
        process.mocha_log("MOCHA", `${indent()} ✔ ${test.title}  (${test.speed}) ${test.duration} ms`);
    });
    runner.on('fail', function (test, err) {
        stats.failures++;
        process.mocha_log("MOCHA", `${indent()} ✘ ${test.title}`);
        test.err = err;
        if (err.expected && err.actual) {
            process.mocha_log("MOCHA", `${indent()} Expected: ${err.expected}, Actual: ${err.actual}`);
        }
        if (err.stack) {
            process.mocha_log("MOCHA", `${indent()} Trace: ${err.stack}`);
        }
    });
    runner.on('start', function () {
        stats.start = new Date()
    });
    runner.on('end', function () {
        stats.end = new Date();
        stats.duration = (stats.end.getTime() - stats.start.getTime()) / 1000;
        process.mocha_log("MOCHA", `\n${stats.passes} Passes`);
        process.mocha_log("MOCHA", `\n${stats.failures} Failures`);
        process.mocha_log("MOCHA", `\n${stats.pending} Pending`);
        process.mocha_log("MOCHA", `\nDone ${stats.passes} / ${stats.passes + stats.failures} (${stats.duration} seconds)`);
        process.mocha_complete();
    });
}
mocha.setup({
    ui: 'bdd',
    reporter: mobileReporter,
    timeout: 9999999
}); // puts 'describe', 'it', etc. into global
debugger;
require("./IModelTestUtils.js");
// Passing tests:
if (true) {
    require("./standalone/Category.test.js");
    require("./standalone/ECDb.test.js");
    require("./standalone/ExcludedElements.test.js");
    require("./standalone/LinearReferencingDomain.test.js");
    require("./standalone/ChangeMerging.test.js");
    require("./standalone/ECSchemaXmlContext.test.js");
    require("./standalone/FunctionalDomain.test.js");
    require("./standalone/PromiseMemoizer.test.js");
    require("./standalone/ClassRegistry.test.js");
    require("./standalone/ECSqlQuery.test.js");
    require("./standalone/GenericDomain.test.js");
    require("./standalone/SqliteStatement.test.js");
    require("./standalone/ColorDef.test.js");
    require("./standalone/ECSqlStatement.test.js");
    require("./standalone/GeometryStream.test.js");
    require("./standalone/TxnManager.test.js");
    require("./standalone/DevTools.test.js");
    require("./standalone/ElementAspect.test.js");
    require("./standalone/IModel.test.js");
    require("./standalone/DisableNativeAssertions.test.js");
    require("./standalone/ElementRoundTrip.test.js");
    require("./standalone/IModelTransformer.test.js");
} else {
    // integeration
    require("./integration//Agent.test.js");
    require("./integration//BriefcaseManager.test.js");
    require("./integration//IModelOpen.test.js");
    require("./integration//IModelWrite.test.js");
    require("./integration//ChangeSummary.test.js");
    require("./integration//ApplyChangeSets.test.js");
    require("./integration//ChangedElements.test.js");
    require("./integration//PushRetry.test.js");
    require("./integration//DebugHubIssues.test.js");
    require("./integration//IModelTransformerHub.test.js");
}
mocha.run();