/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** The frame operations needed by the Vitest tester-frame router; Electron's `WebFrameMain` provides them.
 * @internal
 */
export interface FrameRoutingFrame {
  send(channel: string, ...args: unknown[]): void;
  isDestroyed(): boolean;
  readonly detached?: boolean;
}

/** The WebContents operations needed by the Vitest tester-frame router.
 * @internal
 */
export interface FrameRoutingWebContents {
  send(channel: string, ...args: unknown[]): unknown;
}

/** The Electron event data needed to associate a backend request with its renderer frame.
 * @internal
 */
export interface FrameRoutingEvent {
  readonly sender: FrameRoutingWebContents;
  /** Null when the frame navigated or was destroyed before Electron delivered the message. */
  readonly senderFrame: FrameRoutingFrame | null;
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

const isLive = (frame: FrameRoutingFrame | undefined): frame is FrameRoutingFrame =>
  frame !== undefined && !frame.isDestroyed() && frame.detached !== true;

/**
 * Install the Vitest tester-frame routing needed by backend-originated Electron messages.
 *
 * Vitest runs each test file in an iframe of the provider's window, but the backend sends with
 * `WebContents.send`, which only reaches the window's main frame. This hook remembers the frame
 * that sent each backend request and redirects later `send` calls on that WebContents, and on
 * the window's WebContents, to that frame.
 *
 * Assumptions:
 * - One provider window runs one tester frame at a time, so the frame behind the most recent
 *   request is the one that should receive backend notifications.
 * - Frames are recorded from `ipcMain.handle` requests and from the iTwin RPC transport channels
 *   (`itwin.rpc.objects`, `itwin.rpc.data`). One-way messages sent with `ipcMain.on` on other
 *   channels do not record a frame; this works because frontend startup always invokes the
 *   backend before the backend sends anything.
 * - Frames are tracked as `WebFrameMain` objects and sent to with `WebFrameMain.send`, so the
 *   frame's process does not matter. Once the recorded frame is destroyed or detached, for
 *   example between test files, messages go to the main frame through the original `send`
 *   until the next tester frame makes a request.
 *
 * This is an opt-in backend test hook. It knows about neither production Electron APIs nor
 * application RPC channels beyond the two iTwin RPC transport channels. The window WebContents
 * accessor is lazy because backend initialization runs before the provider creates its
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

  // State belongs to this installation, which is at most one per ipcMain.
  const senderFrames = new WeakMap<FrameRoutingWebContents, FrameRoutingFrame>();
  const routedSenders = new WeakSet<FrameRoutingWebContents>();
  let latestFrame: FrameRoutingFrame | undefined;

  const routeSender = (sender: FrameRoutingWebContents): void => {
    if (routedSenders.has(sender))
      return;

    routedSenders.add(sender);
    const send = sender.send.bind(sender);
    sender.send = (channel: string, ...args: unknown[]) => {
      // Prefer the frame that made this WebContents' latest request; the window's WebContents
      // may not have made one, so fall back to the latest frame overall.
      const frame = [senderFrames.get(sender), latestFrame].find(isLive);
      if (frame === undefined)
        return send(channel, ...args);

      frame.send(channel, ...args);
      return undefined;
    };
  };

  const route = (event: FrameRoutingEvent): void => {
    if (event.senderFrame !== null) {
      latestFrame = event.senderFrame;
      senderFrames.set(event.sender, event.senderFrame);
    }
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
