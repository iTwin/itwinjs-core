/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
const path = require("path");
const inherits = require("util").inherits;
const { requireFromTempNodeModules, monkeyPatch, logBuildWarning } = require("./utils");

const Mocha = requireFromTempNodeModules("mocha/lib/mocha");
const Base = requireFromTempNodeModules("mocha/lib/reporters/base");
const MochaJUnitReporter = requireFromTempNodeModules("mocha-junit-reporter");

const forceConsoleError = () => monkeyPatch(console, "log", (s, ...args) => console.error(...args));
const restoreConsoleLog = () => console.log.reset();

// This is necessary to enable colored output when running in rush test:
Object.defineProperty(Base, "useColors", {
  get: () => !process.env.TF_BUILD && (process.env.FORCE_COLOR !== "false" && process.env.FORCE_COLOR !== "0"),
  set: () => { }
});

// Monkey patch the base mocha reporter to force test errors to be printed to stderr instead of stdout.
// This will allow rush to correctly summarize test failure when running rush test.
monkeyPatch(Base.prototype, "epilogue", function (_super) {
  if (this.stats.failures) {
    forceConsoleError();
    _super();
    restoreConsoleLog();
  } else {
    _super();
  }

  // Also log warnings in CI builds when tests have been skipped.
  if (this.stats.pending) {
    const currentPackage = require(path.join(process.cwd(), "package.json")).name;
    if (this.stats.pending === 1)
      logBuildWarning(`1 test skipped in ${currentPackage}`);
    else
      logBuildWarning(`${this.stats.pending} tests skipped in ${currentPackage}`);
  }
});

// Monkey patch mocha-junit-reporter to log errors when tests fail and warnings when tests are skipped.
monkeyPatch(MochaJUnitReporter.prototype, "flush", function (_super) {
  _super();
  this.epilogue();
});

inherits(MochaJUnitReporter, Base);

// Also force rush test to fail CI builds if describe.only or it.only is used.
// These should only be used for debugging and must not be committed, otherwise we may be accidentally skipping lots of tests.
if (process.env.CI || process.env.TF_BUILD) {
  monkeyPatch(Mocha.prototype, "run", function (_super) {
    this.forbidOnly();
    _super();
  });
}