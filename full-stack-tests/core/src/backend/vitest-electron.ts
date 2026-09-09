/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ElectronHost } from "@itwin/core-electron/main";

interface FrameAwareWebContents {
  send(channel: string, ...args: any[]): unknown;
  sendToFrame?: (frameId: number, channel: string, ...args: any[]) => unknown;
}

interface IpcEvent {
  sender: FrameAwareWebContents;
  frameId: number;
}

/** Route main-process responses to the Vitest tester iframe that initiated the request. */
function installFrameRouting(): void {
  const ipcMain = ElectronHost.ipcMain as typeof ElectronHost.ipcMain & {
    handle(channel: string, listener: (event: IpcEvent, ...args: any[]) => unknown): void;
  } | undefined;
  if (ipcMain === undefined)
    return;

  const installed = ipcMain as typeof ipcMain & { vitestFrameRoutingInstalled?: boolean };
  if (installed.vitestFrameRoutingInstalled)
    return;
  installed.vitestFrameRoutingInstalled = true;

  const frameIds = new WeakMap<object, number>();
  const routedSenders = new WeakSet<object>();
  let currentFrameId: number | undefined;
  const routeSender = (sender: FrameAwareWebContents) => {
    if (routedSenders.has(sender))
      return;

    routedSenders.add(sender);
    const send = sender.send.bind(sender);
    sender.send = (channel: string, ...args: any[]) => {
      const frameId = frameIds.get(sender) ?? currentFrameId;
      if (frameId !== undefined && sender.sendToFrame !== undefined)
        return sender.sendToFrame(frameId, channel, ...args);
      return send(channel, ...args);
    };
  };
  const route = (event: IpcEvent) => {
    currentFrameId = event.frameId;
    frameIds.set(event.sender, event.frameId);
    routeSender(event.sender);

    // IpcHost notifications are sent through BrowserWindow.webContents rather than the
    // sender object on the incoming event. Patch those objects too so backend-originated
    // transaction and editing-scope notifications reach Vitest's child frame.
    const windows = ElectronHost.electron?.BrowserWindow.getAllWindows() ?? [];
    for (const window of windows)
      routeSender(window.webContents);
  };

  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, listener) => handle(channel, async (event, ...args) => {
    route(event);
    return listener(event, ...args);
  });

  ipcMain.on("itwin.rpc.objects", route);
  ipcMain.on("itwin.rpc.data", route);
}

installFrameRouting();

// The existing backend initializer is also used by Certa. Reuse it unchanged and add only
// the frame routing required by Vitest's child tester iframe.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const backendInitialization = require("./backend") as Promise<(() => Promise<void>) | undefined>;

async function init() {
  const shutdown = await backendInitialization;
  installFrameRouting();
  return shutdown;
}

module.exports = init();
