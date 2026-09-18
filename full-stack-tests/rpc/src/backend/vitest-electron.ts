/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";
import { ElectronHost } from "@itwin/core-electron/main";
import { installElectronFrameRouting } from "@itwin/vitest-browser-bridge/electron/frame-routing";
import { BackendTestCallbacks } from "../common/SideChannels";
import { commonSetup } from "./CommonBackendSetup";
import { setupIpcTestElectron } from "./ipc";

/** Route main-process messages to the Vitest tester iframe that initiated the request. */
function routeMessagesToVitestFrame(): void {
  installElectronFrameRouting(
    ElectronHost.ipcMain,
    () => ElectronHost.electron?.BrowserWindow.getAllWindows().map((window) => window.webContents) ?? [],
  );
}

async function init() {
  await commonSetup(registerBackendCallback);
  routeMessagesToVitestFrame();
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "electron");
  registerBackendCallback(BackendTestCallbacks.setChunkThreshold, (value: number) => {
    ElectronHost.rpcConfig.protocol.transferChunkThreshold = value;
    return true;
  });
  setupIpcTestElectron(registerBackendCallback);
}

module.exports = init();
