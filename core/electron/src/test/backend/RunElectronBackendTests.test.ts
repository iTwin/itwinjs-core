/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { spawn, SpawnOptions } from "child_process";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { TestResult, testSuites } from "./ElectronBackendTests";

const packageRoot = path.resolve(__dirname, "../../..");

/** Spawns new Electron process and executes a single test before terminating newly spawned process. */
async function spawnElectronMainProcess(suiteToRun: string, testToRun: string) {
  const command = require("electron/index.js"); // eslint-disable-line @typescript-eslint/no-require-imports

  const args = [
    path.join(packageRoot, "lib/cjs/test/backend/RunSingleTest.js"),
  ];

  const options: SpawnOptions = {
    stdio: ["ipc", "inherit", "inherit"],
    cwd: packageRoot,
    env: {
      ...process.env,
      ELECTRON_SUITE_TITLE: suiteToRun, // eslint-disable-line @typescript-eslint/naming-convention
      ELECTRON_TEST_TITLE: testToRun, // eslint-disable-line @typescript-eslint/naming-convention
    },
  };

  const electronProcess = spawn(command, args, options);

  // Prefer the result RunSingleTest sends over IPC: the process exit status is not reliable on Windows.
  let reportedExitCode: number | undefined;
  electronProcess.on("message", (message: { exitCode: number }) => reportedExitCode = message.exitCode);
  const exitCode = await new Promise<number>((resolve) => {
    electronProcess.on("exit", (status) => resolve(reportedExitCode ?? status ?? 0));
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
