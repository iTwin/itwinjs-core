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
  const suiteTitle = process.env.ELECTRON_SUITE_TITLE;
  const testTitle = process.env.ELECTRON_TEST_TITLE;

  const suiteToRun = testSuites.find((suite) => suite.title === suiteTitle);
  if (suiteToRun === undefined)
    process.exit(TestResult.InvalidArguments);

  const testToRun = suiteToRun.tests.find((test) => test.title === testTitle);
  if (testToRun === undefined)
    process.exit(TestResult.InvalidArguments);

  try {
    await testToRun.func();
  } catch (e: unknown) {
    console.error(e); // eslint-disable-line no-console
    process.exit(TestResult.Failure);
  }

  process.exit(TestResult.Success);
}

void run();
