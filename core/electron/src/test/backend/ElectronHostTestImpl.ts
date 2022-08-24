/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHost, IpcHandler, NativeHost } from "@itwin/core-backend";
import { assert } from "chai";
import { ElectronHost } from "../../ElectronBackend";
import { ElectronHostTest, TestResult } from "./ElectronHostTests";

const funcNameToImpl = new Map([
  [ElectronHostTest.StartupWithoutOptions, startupWithoutOptions],
  [ElectronHostTest.RegisterIpcHandlers, registerIpcHandlers],
  [ElectronHostTest.OpenMainWindow, openMainWindow],
]);

async function run() {
  const testToRun = process.env.ELECTRON_HOST_TEST_TO_RUN;

  const funcToRun = funcNameToImpl.get(testToRun as ElectronHostTest);
  if (typeof funcToRun !== "function")
    process.exit(TestResult.InvalidArguments);

  try {
    await funcToRun();
  } catch (e: unknown) {
    console.error(e); // eslint-disable-line no-console
    process.exit(TestResult.Failure);
  }

  process.exit(TestResult.Success);
}

async function startupWithoutOptions() {
  assert(!ElectronHost.isValid);
  assert(!NativeHost.isValid);
  assert(!IModelHost.isValid);

  await ElectronHost.startup();

  assert(ElectronHost.isValid);
  assert(NativeHost.isValid);
  assert(IModelHost.isValid);

  assert(ElectronHost.electron !== undefined);
  assert(ElectronHost.app !== undefined);
}

async function registerIpcHandlers() {
  class RpcHandlerMock extends IpcHandler {
    public override get channelName() { return "RpcHandlerMock-channel"; }
    public static wasRegisterCalled = false;

    public static override register() {
      RpcHandlerMock.wasRegisterCalled = true;
      return () => undefined;
    }
  }

  await ElectronHost.startup({
    electronHost: {
      ipcHandlers: [RpcHandlerMock],
    },
  });

  assert(RpcHandlerMock.wasRegisterCalled);
}

async function openMainWindow() {
  await ElectronHost.startup();
  const electron = ElectronHost.electron;

  let windows = electron.BrowserWindow.getAllWindows();
  assert(windows.length === 0);

  await ElectronHost.openMainWindow();

  windows = electron.BrowserWindow.getAllWindows();
  assert(windows.length === 1);
  assert(ElectronHost.mainWindow?.id === windows[0].id);
}

void run();
