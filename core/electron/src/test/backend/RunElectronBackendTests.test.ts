/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { spawn, SpawnOptions } from "child_process";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { TestResult, testSuites } from "./ElectronBackendTests";

/** Spawns new Electron process and executes a single test before terminating newly spawned process. */
async function spawnElectronMainProcess(suiteToRun: string, testToRun: string) {
  const command = require("electron/index.js"); // eslint-disable-line @typescript-eslint/no-require-imports

  const args = [
    path.resolve(process.cwd(), "lib/cjs/test/backend/RunSingleTest.js"),
  ];

  const options: SpawnOptions = {
    stdio: ["ipc", "inherit", "inherit"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_SUITE_TITLE: suiteToRun, // eslint-disable-line @typescript-eslint/naming-convention
      ELECTRON_TEST_TITLE: testToRun, // eslint-disable-line @typescript-eslint/naming-convention
    },
  };

  const electronProcess = spawn(command, args, options);

  const exitCode = await new Promise<number>((resolve) => {
    electronProcess.on("exit", (status) => resolve(status || 0));
  });
  expect(exitCode).toBe(TestResult.Success);
}

// Goes though every test registered in [testSuites] and executed each in separate Electron main process.
for (const testSuite of testSuites) {
  describe(testSuite.title, () => {
    for (const test of testSuite.tests) {
      it(test.title, async () => {
        await spawnElectronMainProcess(testSuite.title, test.title);
      });
    }
  });
}
