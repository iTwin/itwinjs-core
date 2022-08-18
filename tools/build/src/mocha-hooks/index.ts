/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Runner, Suite } from "mocha";

const isCI = process.env.CI || process.env.TF_BUILD;

// Force rush test to fail CI builds if describe.only or it.only is used.
// These should only be used for debugging and must not be committed, otherwise we may be accidentally skipping lots of tests.
if (isCI) {
  if (typeof (mocha) !== "undefined")
    mocha.forbidOnly();
  else
    require.cache[require.resolve("mocha/lib/mocharc.json", { paths: require.main?.paths ?? module.paths })]!.exports.forbidOnly = true;
}

// NB: Unlike our reporter or the side effects above, each of the following functions will always execute in the same context as the tests themselves.
// So when tests are run by certa, this is not guaranteed to be a node environment!
export function mochaGlobalSetup(this: Runner) {
  function retryFlakyTests(suite: Suite) {
    for (const test of suite.tests) {
      if (/#FLAKY/.test(test.title))
        test.retries(3);
    }
    for (const child of suite.suites) {
      retryFlakyTests(child);
    }
  }

  retryFlakyTests(this.suite);
}

// This hook is only used by certa.  Since `isCI` may not exist in a browser context, we need the conditional assignment.
export const mochaOptions = (isCI) ? (() => mocha.forbidOnly()) : (() => { });