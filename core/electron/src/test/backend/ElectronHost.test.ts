/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHost, IpcHandler, NativeHost } from "@itwin/core-backend";
import { assert } from "chai";
import { ElectronHost } from "../../ElectronBackend";
import { TestSuite } from "./ElectronBackendTests";

export const electronHostTestSuite: TestSuite = {
  title: "ElectronHost tests.",
  tests: [
    {
      title: "Should start without options.",
      func: testStartWithoutOptions,
    },
    {
      title: "Should register ipc handler.",
      func: testRegisterIpcHandler,
    },
    {
      title: "Should open main window.",
      func: testOpenMainWindow,
    },
  ],
};

async function testStartWithoutOptions() {
  assert(!ElectronHost.isValid);
  assert(!NativeHost.isValid);
  assert(!IModelHost.isValid);

  await ElectronHost.startup();

  assert(ElectronHost.isValid);
  assert(NativeHost.isValid);
  assert(IModelHost.isValid);

  assert(ElectronHost.electron !== undefined);
  assert(ElectronHost.app !== undefined);
};

async function testRegisterIpcHandler() {
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

async function testOpenMainWindow() {
  await ElectronHost.startup();
  const electron = ElectronHost.electron;

  let windows = electron.BrowserWindow.getAllWindows();
  assert(windows.length === 0);

  await ElectronHost.openMainWindow();

  windows = electron.BrowserWindow.getAllWindows();
  assert(windows.length === 1);
  assert(ElectronHost.mainWindow?.id === windows[0].id);
}
