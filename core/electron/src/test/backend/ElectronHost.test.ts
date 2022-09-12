/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { spawn, SpawnOptions } from "child_process";
import * as path from "path";
import { TestResult, testSuites } from "./ElectronTestCommon";

async function spawnElectronMainProcess(suiteToRun: string, testToRun: string) {
  const command = require("electron/index.js"); // eslint-disable-line @typescript-eslint/no-var-requires

  const args = [
    path.join(__dirname, "./ElectronHostTestImpl.js"),
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

  const exitCode = await new Promise((resolve) => {
    electronProcess.on("exit", (status) => resolve(status || 0));
  });
  assert.equal(exitCode, TestResult.Success);
}

for (const testSuite of testSuites) {
  describe(testSuite.title, async () => {
    for (const test of testSuite.tests) {
      it(test.title, async () => {
        await spawnElectronMainProcess(testSuite.title, test.title);
      });
    }
  });
}
