/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TestResult, testSuites } from "./ElectronBackendTests";

/** Finds and runs a single test before terminating current process.
 *
 * For test to be run, environment variables ELECTRON_SUITE_TITLE, ELECTRON_TEST_TITLE must be set
 * and test must be defined in [testSuites].
 */
async function run() {
  const suiteToRun = process.env.ELECTRON_SUITE_TITLE;
  const testToRun = process.env.ELECTRON_TEST_TITLE;

  const suite = testSuites.find((suite) => suite.title === suiteToRun);
  if (suite === undefined)
    process.exit(TestResult.InvalidArguments);

  const test = suite.tests.find((test) => test.title === testToRun);
  if (test === undefined)
    process.exit(TestResult.InvalidArguments);

  try {
    await test.func();
  } catch (e: unknown) {
    console.error(e); // eslint-disable-line no-console
    process.exit(TestResult.Failure);
  }

  process.exit(TestResult.Success);
}

void run();
