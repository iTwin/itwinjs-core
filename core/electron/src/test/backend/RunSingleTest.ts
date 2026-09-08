/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// This file is only ever loaded as the entry point of a spawned Electron main process, so unlike
// ElectronHost.ts it can import electron directly.
import { app } from "electron";
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
  const testToRun = suiteToRun?.tests.find((test) => test.title === testTitle);
  if (testToRun === undefined)
    return exit(TestResult.InvalidArguments);

  let exitCode = TestResult.Success;
  try {
    await testToRun.func();
  } catch (e: unknown) {
    console.error(e); // eslint-disable-line no-console
    exitCode = TestResult.Failure;
  }

  return exit(exitCode);
}

/** Tests that never start `ElectronHost` can finish before Chromium is done initializing. Tearing the main
 * process down at that point aborts it (STATUS_BREAKPOINT on Windows), so wait for the app before exiting.
 * @note This must not be awaited before the test runs: `ElectronHost.startup` registers privileged schemes
 * only while the app is not yet ready.
 */
async function exit(exitCode: number): Promise<void> {
  await app.whenReady();
  app.exit(exitCode);
}

void run();
