/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
const debugLeaks = process.env.DEBUG_LEAKS;
if (debugLeaks)
  require("wtfnode");

import * as path from "path";
import type { MochaOptions, Reporter, Runner } from "mocha";

const fs = require("fs-extra");
const { logBuildWarning, logBuildError, failBuild } = require("../scripts/utils/utils");

const Base = require("mocha/lib/reporters/base");
const Spec = require("mocha/lib/reporters/spec");
const MochaJUnitReporter = require("mocha-junit-reporter");

function withStdErr(callback: () => void) {
  const originalConsoleLog = Base.consoleLog;
  Base.consoleLog = console.error;
  callback();
  Base.consoleLog = originalConsoleLog;
}

// This is necessary to enable colored output when running in rush test:
Object.defineProperty(Base, "color", {
  get: () => process.env.FORCE_COLOR !== "false" && process.env.FORCE_COLOR !== "0",
  set: () => { },
});

class BentleyMochaReporter extends Spec {
  protected _junitReporter: Reporter;
  constructor(runner: Runner, _options: MochaOptions) {
    super(...arguments);
    this._junitReporter = new MochaJUnitReporter(...arguments);
    this.flakyTests = 0;

    runner.on("pass", (test: any) => {
      if (/#FLAKY/.test(test.title))
        this.flakyTests++;
      if (test.currentRetry() > 0) {
        logBuildWarning(`Test "${test.fullTitle()}" only succeeded after ${test.currentRetry()} retries.`);
      }
    });
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

    // Detect hangs caused by tests that leave timers/other handles open - not possible in electron frontends.
    if (!("electron" in process.versions)) {
      // NB: By calling unref() on this timer, we stop it from keeping the process alive, so it will only fire if _something else_ is still keeping
      // the process alive after 5 seconds.  This also has the benefit of preventing the timer from showing up in wtfnode's dump of open handles.
      setTimeout(() => {
        logBuildError(`Handle leak detected. Node was still running 5 seconds after tests completed.`);
        if (debugLeaks) {
          const wtf = require("wtfnode");
          wtf.setLogger("info", console.error);
          wtf.dump();
        } else {
          console.error("Try running with the DEBUG_LEAKS env var set to see open handles.");
        }

        // Not sure why, but process.exit(1) wasn't working here...
        process.kill(process.pid);
      }, 5000).unref();
    }

    const pluralize = (i: number) => (i === 1) ? `1 test` : `${i} tests`;
    const currentPkgJson = path.join(process.cwd(), "package.json");
    const packageSuffix = (fs.existsSync(currentPkgJson)) ? ` in ${require(currentPkgJson).name}` : "";

    // Log warnings in CI builds when tests are marked #FLAKY.
    if (this.flakyTests)
      logBuildWarning(`${pluralize(this.flakyTests)} marked #FLAKY${packageSuffix}`);

    // Also log warnings in CI builds when tests have been skipped.
    if (this.stats.pending)
      logBuildWarning(`${pluralize(this.stats.pending)} skipped${packageSuffix}`);
  }
}

module.exports = BentleyMochaReporter;
