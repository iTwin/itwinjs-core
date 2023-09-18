/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
const debugLeaks = process.env.DEBUG_LEAKS;
let asyncResourceStats: Map<number, any>;
if (debugLeaks) {
  require("wtfnode");
  asyncResourceStats = new Map<number, any>();
  setupAsyncHooks();
}

function setupAsyncHooks() {
  const async_hooks = require("node:async_hooks");

  const init = (asyncId: number, type: string, triggerAsyncId: number, _resource: any) => {
    const eid = async_hooks.executionAsyncId(); // (An executionAsyncId() of 0 means that it is being executed from C++ with no JavaScript stack above it.)
    const stack = new Error().stack;
    asyncResourceStats.set(asyncId, {type, eid, triggerAsyncId, initStack: stack});
  };
  const destroy = (asyncId: number) => {
    if (asyncResourceStats.get(asyncId) === undefined) {
      return;
    }
    asyncResourceStats.delete(asyncId);
  };

  const asyncHook = async_hooks.createHook({init, destroy});
  asyncHook.enable();
}
const fs = require("fs-extra");
const path = require("path");
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

declare const mocha: any;
const isCI = process.env.CI || process.env.TF_BUILD;

// Force rush test to fail CI builds if describe.only or it.only is used.
// These should only be used for debugging and must not be committed, otherwise we may be accidentally skipping lots of tests.
if (isCI) {
  if (typeof (mocha) !== "undefined")
    mocha.forbidOnly();
  else
    require.cache[require.resolve("mocha/lib/mocharc.json", { paths: require.main?.paths ?? module.paths })]!.exports.forbidOnly = true;
}

// This is necessary to enable colored output when running in rush test:
Object.defineProperty(Base, "color", {
  get: () => process.env.FORCE_COLOR !== "false" && process.env.FORCE_COLOR !== "0",
  set: () => { },
});

class BentleyMochaReporter extends Spec {
  protected _junitReporter: any;
  constructor(_runner: any, _options: any) {
    super(...arguments);
    this._junitReporter = new MochaJUnitReporter(...arguments);
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
      // the process alive after 30 seconds.  This also has the benefit of preventing the timer from showing up in wtfnode's dump of open handles.
      setTimeout(() => {
        logBuildError(`Handle leak detected. Node was still running 30 seconds after tests completed.`);
        if (debugLeaks) {
          const wtf = require("wtfnode");
          wtf.setLogger("info", console.error);
          wtf.dump();

          let activeResourcesInfo: string[] = (process as any).getActiveResourcesInfo(); // https://nodejs.dev/en/api/v18/process#processgetactiveresourcesinfo (Not added to @types/node yet I suppose)
          console.error(activeResourcesInfo);

          activeResourcesInfo = activeResourcesInfo.map((value) => value.toLowerCase());
          // asyncResourceStats.set(asyncId, {before: 0, after: 0, type, eid, triggerAsyncId, initStack: stack});
          asyncResourceStats.forEach((value, key) => {
            if (activeResourcesInfo.includes(value.type.toLowerCase())) {
              console.error(`asyncId: ${key}: type: ${value.type}, eid: ${value.eid},triggerAsyncId: ${value.triggerAsyncId}, initStack: ${value.initStack}`);
            }
          });
        } else {
          console.error("Try running with the DEBUG_LEAKS env var set to see open handles.");
        }

        // Not sure why, but process.exit(1) wasn't working here...
        process.kill(process.pid);
      }, 30 * 1000).unref();
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
