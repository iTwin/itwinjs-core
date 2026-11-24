/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import {
  type FrameRoutingEvent,
  type FrameRoutingFrame,
  type FrameRoutingIpcMain,
  type FrameRoutingWebContents,
  installElectronFrameRouting,
} from "../electron/frame-routing.js";

class FakeWebContents implements FrameRoutingWebContents {
  public readonly sent: unknown[][] = [];

  public send(channel: string, ...args: unknown[]): void {
    this.sent.push([channel, ...args]);
  }
}

class FakeFrame implements FrameRoutingFrame {
  public readonly sent: unknown[][] = [];
  public destroyed = false;
  public detached = false;

  public send(channel: string, ...args: unknown[]): void {
    this.sent.push([channel, ...args]);
  }

  // eslint-disable-next-line @itwin/prefer-get -- mirrors Electron's WebFrameMain.isDestroyed().
  public isDestroyed(): boolean {
    return this.destroyed;
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

const eventFrom = (sender: FrameRoutingWebContents, senderFrame: FrameRoutingFrame | null): FrameRoutingEvent => ({ sender, senderFrame });

describe("Electron Vitest frame routing", () => {
  it("does nothing when ipcMain is not available", () => {
    expect(() => installElectronFrameRouting(undefined, () => [])).not.toThrow();
  });

  it("routes request responses and backend notifications to the latest tester frame", () => {
    const ipcMain = new FakeIpcMain();
    const requestSender = new FakeWebContents();
    const windowContents = new FakeWebContents();
    installElectronFrameRouting(ipcMain, () => [windowContents]);

    const firstFrame = new FakeFrame();
    ipcMain.emit("itwin.rpc.objects", eventFrom(requestSender, firstFrame));
    requestSender.send("response", 1);
    windowContents.send("notification", 2);

    expect(firstFrame.sent).toEqual([["response", 1], ["notification", 2]]);
    expect(requestSender.sent).toEqual([]);
    expect(windowContents.sent).toEqual([]);

    const secondFrame = new FakeFrame();
    ipcMain.emit("itwin.rpc.data", eventFrom(new FakeWebContents(), secondFrame));
    windowContents.send("notification", 3);
    expect(secondFrame.sent).toEqual([["notification", 3]]);
  });

  it("captures the frame for handlers registered after installation", async () => {
    const ipcMain = new FakeIpcMain();
    const requestSender = new FakeWebContents();
    const windowContents = new FakeWebContents();
    installElectronFrameRouting(ipcMain, () => [windowContents]);

    const handler = vi.fn(() => "result");
    ipcMain.handle("application", handler);
    const frame = new FakeFrame();
    const event = eventFrom(requestSender, frame);
    await expect(ipcMain.invoke("application", event, "argument")).resolves.toBe("result");

    expect(handler).toHaveBeenCalledWith(event, "argument");
    windowContents.send("notification");
    expect(frame.sent).toEqual([["notification"]]);
  });

  it("prefers a sender's own live frame over the latest frame from another sender", () => {
    const ipcMain = new FakeIpcMain();
    installElectronFrameRouting(ipcMain, () => []);

    const firstSender = new FakeWebContents();
    const firstFrame = new FakeFrame();
    ipcMain.emit("itwin.rpc.objects", eventFrom(firstSender, firstFrame));
    const secondFrame = new FakeFrame();
    ipcMain.emit("itwin.rpc.objects", eventFrom(new FakeWebContents(), secondFrame));

    firstSender.send("response");
    expect(firstFrame.sent).toEqual([["response"]]);
    expect(secondFrame.sent).toEqual([]);
  });

  it.each([
    { state: "destroyed", end: (frame: FakeFrame) => frame.destroyed = true },
    { state: "detached", end: (frame: FakeFrame) => frame.detached = true },
  ])("falls back to the original send once the tester frame is $state", ({ end }) => {
    const ipcMain = new FakeIpcMain();
    const requestSender = new FakeWebContents();
    const windowContents = new FakeWebContents();
    installElectronFrameRouting(ipcMain, () => [windowContents]);

    const frame = new FakeFrame();
    ipcMain.emit("itwin.rpc.objects", eventFrom(requestSender, frame));
    end(frame);
    requestSender.send("response");
    windowContents.send("notification");

    expect(frame.sent).toEqual([]);
    expect(requestSender.sent).toEqual([["response"]]);
    expect(windowContents.sent).toEqual([["notification"]]);
  });

  it("does not record a frame when the event has none", () => {
    const ipcMain = new FakeIpcMain();
    const windowContents = new FakeWebContents();
    installElectronFrameRouting(ipcMain, () => [windowContents]);

    ipcMain.emit("itwin.rpc.objects", eventFrom(new FakeWebContents(), null));
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
