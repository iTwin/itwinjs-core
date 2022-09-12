/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { spawn, SpawnOptions } from "child_process";
import * as path from "path";
import { ElectronHostTest, TestResult } from "./ElectronHostTests";

async function spawnElectronMainProcess(testToRun: ElectronHostTest) {
  const command = require("electron/index.js"); // eslint-disable-line @typescript-eslint/no-var-requires

  const args = [
    path.join(__dirname, "./ElectronHostTestImpl.js"),
  ];

  const options: SpawnOptions = {
    stdio: ["ipc", "inherit", "inherit"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_HOST_TEST_TO_RUN: testToRun, // eslint-disable-line @typescript-eslint/naming-convention
    },
  };

  const electronProcess = spawn(command, args, options);

  const exitCode = await new Promise((resolve) => {
    electronProcess.on("exit", (status) => resolve(status || 0));
  });
  assert.equal(exitCode, TestResult.Success);
}

describe("ElectronHost tests.", async () => {
  it("Should start without options.", async () => {
    await spawnElectronMainProcess(ElectronHostTest.StartupWithoutOptions);
  });

  it("Should register ipc handler.", async () => {
    await spawnElectronMainProcess(ElectronHostTest.RegisterIpcHandlers);
  });

  it("Should open main window.", async () => {
    await spawnElectronMainProcess(ElectronHostTest.OpenMainWindow);
  });
});
