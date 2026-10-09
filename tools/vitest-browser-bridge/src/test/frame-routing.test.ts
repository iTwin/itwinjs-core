/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import {
  type FrameRoutingEvent,
  type FrameRoutingIpcMain,
  type FrameRoutingWebContents,
  installElectronFrameRouting,
} from "../electron/frame-routing.js";

class FakeWebContents implements FrameRoutingWebContents {
  public readonly sent: unknown[][] = [];
  public readonly sentToFrames: Array<[number, string, unknown[]]> = [];

  public send(channel: string, ...args: unknown[]): void {
    this.sent.push([channel, ...args]);
  }

  public sendToFrame(frameId: number, channel: string, ...args: unknown[]): void {
    this.sentToFrames.push([frameId, channel, args]);
  }
}

class FakeIpcMain implements FrameRoutingIpcMain {
  public readonly handlers = new Map<string, (event: FrameRoutingEvent, ...args: unknown[]) => unknown>();
  public readonly listeners = new Map<string, Array<(event: FrameRoutingEvent, ...args: unknown[]) => unknown>>();
  public handleCount = 0;
  public onCount = 0;

  public handle(channel: string, listener: (event: FrameRoutingEvent, ...args: unknown[]) => unknown): void {
    this.handleCount++;
    this.handlers.set(channel, listener);
  }

  public on(channel: string, listener: (event: FrameRoutingEvent, ...args: unknown[]) => unknown): void {
    this.onCount++;
    const listeners = this.listeners.get(channel) ?? [];
    listeners.push(listener);
    this.listeners.set(channel, listeners);
  }

  public emit(channel: string, event: FrameRoutingEvent): void {
    for (const listener of this.listeners.get(channel) ?? [])
      listener(event);
  }

  public async invoke(channel: string, event: FrameRoutingEvent, ...args: unknown[]): Promise<unknown> {
    return this.handlers.get(channel)?.(event, ...args);
  }
}

const eventFrom = (sender: FrameRoutingWebContents, frameId: number): FrameRoutingEvent => ({ sender, frameId });

describe("Electron Vitest frame routing", () => {
  it("does nothing when ipcMain is not available", () => {
    expect(() => installElectronFrameRouting(undefined, () => [])).not.toThrow();
  });

  it("routes request responses and backend notifications to the latest tester frame", () => {
    const ipcMain = new FakeIpcMain();
    const requestSender = new FakeWebContents();
    const windowContents = new FakeWebContents();
    installElectronFrameRouting(ipcMain, () => [windowContents]);

    ipcMain.emit("itwin.rpc.objects", eventFrom(requestSender, 7));
    requestSender.send("response", 1);
    windowContents.send("notification", 2);

    expect(requestSender.sentToFrames).toEqual([[7, "response", [1]]]);
    expect(windowContents.sentToFrames).toEqual([[7, "notification", [2]]]);

    const secondRequestSender = new FakeWebContents();
    ipcMain.emit("itwin.rpc.data", eventFrom(secondRequestSender, 11));
    windowContents.send("notification", 3);
    expect(windowContents.sentToFrames).toEqual([
      [7, "notification", [2]],
      [11, "notification", [3]],
    ]);
  });

  it("captures the frame for handlers registered after installation", async () => {
    const ipcMain = new FakeIpcMain();
    const requestSender = new FakeWebContents();
    const windowContents = new FakeWebContents();
    installElectronFrameRouting(ipcMain, () => [windowContents]);

    const handler = vi.fn(() => "result");
    ipcMain.handle("application", handler);
    await expect(ipcMain.invoke("application", eventFrom(requestSender, 13), "argument")).resolves.toBe("result");

    expect(handler).toHaveBeenCalledWith(eventFrom(requestSender, 13), "argument");
    windowContents.send("notification");
    expect(windowContents.sentToFrames).toEqual([[13, "notification", []]]);
  });

  it("preserves the original send when no frame-aware send is available", () => {
    const ipcMain = new FakeIpcMain();
    const windowContents = new class implements FrameRoutingWebContents {
      public readonly sent: unknown[][] = [];
      public send(channel: string, ...args: unknown[]): void {
        this.sent.push([channel, ...args]);
      }
    }();
    installElectronFrameRouting(ipcMain, () => [windowContents]);

    ipcMain.emit("itwin.rpc.objects", eventFrom(new FakeWebContents(), 17));
    windowContents.send("notification", true);

    expect(windowContents.sent).toEqual([["notification", true]]);
  });

  it("installs only once for an ipcMain instance", () => {
    const ipcMain = new FakeIpcMain();
    installElectronFrameRouting(ipcMain, () => []);
    installElectronFrameRouting(ipcMain, () => []);
    ipcMain.handle("application", () => undefined);

    expect(ipcMain.handleCount).toBe(1);
    expect(ipcMain.onCount).toBe(2);
  });
});
