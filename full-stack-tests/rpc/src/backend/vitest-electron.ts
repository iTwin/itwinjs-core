/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { BackendTestCallbacks } from "../common/SideChannels";
import { commonSetup } from "./CommonBackendSetup";
import { setupIpcTestElectron } from "./ipc";

interface FrameAwareWebContents {
  send(channel: string, ...args: any[]): unknown;
  sendToFrame?: (frameId: number, channel: string, ...args: any[]) => unknown;
}

/** Route main-process messages to the Vitest tester iframe that initiated the request. */
function routeMessagesToVitestFrame() {
  const frameIds = new WeakMap<object, number>();
  const routedSenders = new WeakSet<object>();
  const route = (event: { sender: FrameAwareWebContents, frameId: number }) => {
    const sender = event.sender;
    frameIds.set(sender, event.frameId);
    if (routedSenders.has(sender))
      return;

    routedSenders.add(sender);
    const send = sender.send.bind(sender);
    sender.send = (channel: string, ...args: any[]) => {
      const frameId = frameIds.get(sender);
      if (frameId !== undefined && sender.sendToFrame !== undefined)
        return sender.sendToFrame(frameId, channel, ...args);
      return send(channel, ...args);
    };
  };

  const ipcMain = ElectronHost.ipcMain as typeof ElectronHost.ipcMain & {
    handle(channel: string, listener: (event: any, ...args: any[]) => unknown): void;
  };
  // The provider registers its callback handler after this backend init module runs, so wrapping handle here also captures
  // the frame for callback-driven IpcHost responses.
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, listener) => handle(channel, async (event, ...args) => {
    route(event);
    return listener(event, ...args);
  });

  ipcMain.on("itwin.rpc.objects", route);
  ipcMain.on("itwin.rpc.data", route);
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
