/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TestResult, testSuites } from "./ElectronTestCommon";

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
