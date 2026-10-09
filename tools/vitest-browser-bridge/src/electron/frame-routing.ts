/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** The WebContents operations needed by the Vitest tester-frame router.
 * @internal
 */
export interface FrameRoutingWebContents {
  send(channel: string, ...args: unknown[]): unknown;
  sendToFrame?: (frameId: number, channel: string, ...args: unknown[]) => unknown;
}

/** The Electron event data needed to associate a backend request with its renderer frame.
 * @internal
 */
export interface FrameRoutingEvent {
  readonly sender: FrameRoutingWebContents;
  readonly frameId: number;
}

/** The Electron IPC operations needed by the Vitest tester-frame router.
 * @internal
 */
export interface FrameRoutingIpcMain {
  handle(channel: string, listener: (event: FrameRoutingEvent, ...args: unknown[]) => unknown): void;
  on(channel: string, listener: (event: FrameRoutingEvent, ...args: unknown[]) => unknown): unknown;
}

const ROUTING_INSTALLED = Symbol.for("@itwin/vitest-browser-bridge/electron-frame-routing");
type MarkedIpcMain = FrameRoutingIpcMain & { [ROUTING_INSTALLED]?: boolean };

/**
 * Install the Vitest tester-frame routing needed by backend-originated Electron messages.
 *
 * This is intentionally an opt-in backend test hook. It knows about neither production Electron
 * APIs nor application RPC channels beyond the two iTwin RPC transport channels. The window
 * WebContents accessor is lazy because backend initialization runs before the provider creates its
 * BrowserWindow.
 *
 * @internal
 */
export function installElectronFrameRouting(
  ipcMain: FrameRoutingIpcMain | undefined,
  getWindowWebContents: () => readonly FrameRoutingWebContents[],
): void {
  if (ipcMain === undefined)
    return;

  const markedIpcMain = ipcMain as MarkedIpcMain;
  if (markedIpcMain[ROUTING_INSTALLED])
    return;
  markedIpcMain[ROUTING_INSTALLED] = true;

  const frameIds = new WeakMap<FrameRoutingWebContents, number>();
  const routedSenders = new WeakSet<FrameRoutingWebContents>();
  let currentFrameId: number | undefined;

  const routeSender = (sender: FrameRoutingWebContents): void => {
    if (routedSenders.has(sender))
      return;

    routedSenders.add(sender);
    const send = sender.send.bind(sender);
    sender.send = (channel: string, ...args: unknown[]) => {
      const frameId = frameIds.get(sender) ?? currentFrameId;
      if (frameId !== undefined && sender.sendToFrame !== undefined)
        return sender.sendToFrame(frameId, channel, ...args);
      return send(channel, ...args);
    };
  };

  const route = (event: FrameRoutingEvent): void => {
    currentFrameId = event.frameId;
    frameIds.set(event.sender, event.frameId);
    routeSender(event.sender);

    // Backend-originated IpcHost messages use BrowserWindow.webContents rather than the sender
    // from the request. Patch those objects lazily after the provider has created its window.
    for (const sender of getWindowWebContents())
      routeSender(sender);
  };

  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, listener) => handle(channel, async (event, ...args) => {
    route(event);
    return listener(event, ...args);
  });

  ipcMain.on("itwin.rpc.objects", route);
  ipcMain.on("itwin.rpc.data", route);
}
