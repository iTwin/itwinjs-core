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
  // Tests that never start ElectronHost can finish before Chromium is done initializing. Tearing the main
  // process down at that point aborts it (STATUS_BREAKPOINT on Windows), so wait for the app and let
  // Electron own the exit.
  await app.whenReady();

  const suiteTitle = process.env.ELECTRON_SUITE_TITLE;
  const testTitle = process.env.ELECTRON_TEST_TITLE;

  const suiteToRun = testSuites.find((suite) => suite.title === suiteTitle);
  const testToRun = suiteToRun?.tests.find((test) => test.title === testTitle);
  if (testToRun === undefined) {
    app.exit(TestResult.InvalidArguments);
    return;
  }

  let exitCode = TestResult.Success;
  try {
    await testToRun.func();
  } catch (e: unknown) {
    console.error(e); // eslint-disable-line no-console
    exitCode = TestResult.Failure;
  }

  app.exit(exitCode);
}

void run();
