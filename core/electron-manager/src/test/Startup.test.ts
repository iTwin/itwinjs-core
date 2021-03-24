/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ElectronHost, ElectronHostOptions } from "../ElectronBackend";
import { assert } from "chai";
import * as path from "path";
import { spawn } from "child_process";

const startElectron = async (expectedExitCode: number, localEnv: any) => {
  const proc = spawn(require("electron/index.js"), [path.join(__dirname, "Electron.js")], { stdio: ["ipc", "pipe", "pipe"], cwd: process.cwd(), env: localEnv });
  proc.stdout.on("data", (data: any) => process.stdout.write(data));
  proc.stderr.on("data", (data: any) => process.stderr.write(data));
  const exitCode = await new Promise((resolve) => {
    proc.on("exit", (status) => resolve(status || 0));
  });
  assert.equal(exitCode, expectedExitCode);
};

describe("ElectronBackend", async () => {
  it("fails running under Node", () => {
    assert.throws(() => ElectronHost.startup(), Error, `Not running under Electron`);
  });

  it("initializes correctly without ElectronBackendOptions", async () => {
    startElectron(0, process.env);
  });

  it("initializes correctly with  ElectronBackendOptions (empty options)", async () => {
    const localEnv = {
      ...process.env,
      startupOptions: ""
    };
    startElectron(0, localEnv);
  });

  it("initializes correctly with  ElectronBackendOptions (default options)", async () => {
    const localEnv = {
      ...process.env,
      startupOptions: "defaultOptions"

    }
    startElectron(0, localEnv);
  });



});
