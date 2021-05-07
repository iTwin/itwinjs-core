/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
import * as path from "path";

const fs = require("fs-extra");
const { logBuildWarning, logBuildError, failBuild } = require("../scripts/rush/utils");

const Base = require("mocha/lib/reporters/base");
const Spec = require("mocha/lib/reporters/spec");
const MochaJUnitReporter = require("mocha-junit-reporter");

function withStdErr(callback: () => void) {
  const originalConsoleLog = console.log;
  console.log = console.error;
  callback();
  console.log = originalConsoleLog;
}

const isCI = process.env.CI || process.env.TF_BUILD;

// This is necessary to enable colored output when running in rush test:
Object.defineProperty(Base, "color", {
  get: () => process.env.FORCE_COLOR !== "false" && process.env.FORCE_COLOR !== "0",
  set: () => { },
});

class BentleyMochaReporter extends Spec {
  protected _junitReporter: any;
  constructor(_runner: any, options: any) {
    super(...arguments);
    this._junitReporter = new MochaJUnitReporter(...arguments);

    // Force rush test to fail CI builds if describe.only or it.only is used.
    // These should only be used for debugging and must not be committed, otherwise we may be accidentally skipping lots of tests.
    if (isCI)
      options.forbidOnly = true;
  }

  public epilogue(...args: any[]) {
    // Force test errors to be printed to stderr instead of stdout.
    // This will allow rush to correctly summarize test failure when running rush test.
    if (this.stats.failures) {
      withStdErr(() => super.epilogue(...args));
    } else {
      super.epilogue(...args);

      if (0 === this.stats.passes) {
        logBuildError("There were 0 passing tests.  That doesn't seem right."
          + "\nIf there are really no passing tests and no failures, then what was even the point?"
          + "\nIt seems likely that tests were skipped by it.only, it.skip, or grep filters, so I'm going to fail now.");
        failBuild();
      }
    }

    if (!this.stats.pending)
      return;

    // Also log warnings in CI builds when tests have been skipped.
    const currentPkgJson = path.join(process.cwd(), "package.json");

    if (fs.existsSync(currentPkgJson)) {
      const currentPackage = require(currentPkgJson).name;
      if (this.stats.pending === 1)
        logBuildWarning(`1 test skipped in ${currentPackage}`);
      else
        logBuildWarning(`${this.stats.pending} tests skipped in ${currentPackage}`);
    } else {
      if (this.stats.pending === 1)
        logBuildWarning(`1 test skipped`);
      else
        logBuildWarning(`${this.stats.pending} tests skipped`);
    }
  }
}

module.exports = BentleyMochaReporter;
