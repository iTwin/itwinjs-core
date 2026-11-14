/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearBackendCallbacks,
  dispatchBackendCallback,
  registerBackendCallback,
} from "../callbacks/backend.js";
import { installElectronCallbackHandler } from "../callbacks/electron.js";
import { unwrapCallbackResponse } from "../callbacks/protocol.js";

interface FakeEvent {
  readonly sender: { readonly id: number };
}

class FakeIpcMain {
  public handler?: (event: FakeEvent, payload: unknown) => Promise<unknown>;
  public handledChannels: string[] = [];
  public removedChannels: string[] = [];

  public handle(channel: string, listener: (event: FakeEvent, payload: unknown) => Promise<unknown>): void {
    this.handledChannels.push(channel);
    this.handler = listener;
  }

  public removeHandler(channel: string): void {
    this.removedChannels.push(channel);
    this.handler = undefined;
  }
}

const eventFrom = (id: number): FakeEvent => ({ sender: { id } });
const request = (name: string, args: readonly unknown[]) => ({ name, args });

describe("callback transport", () => {
  beforeEach(() => clearBackendCallbacks());

  it("validates callback names and argument payloads", async () => {
    registerBackendCallback("add", (a: number, b: number) => a + b);

    await expect(dispatchBackendCallback(request("add", [2, 5]))).resolves.toEqual({ ok: true, value: 7 });
    await expect(dispatchBackendCallback({ name: "add", args: "not-an-array" }))
      .resolves.toMatchObject({ ok: false, error: { message: "Callback arguments must be an array." } });
    await expect(dispatchBackendCallback(request("", [])))
      .resolves.toMatchObject({ ok: false, error: { message: "Callback name must be a non-empty string." } });
  });

  it("serializes every thrown value into an explicit failure response", async () => {
    registerBackendCallback("syncFailure", () => {
      throw new Error("sync failure");
    });
    registerBackendCallback("asyncFailure", async () => {
      throw new Error("async failure");
    });
    registerBackendCallback("nullPrototypeFailure", () => {
      throw Object.create(null);
    });
    registerBackendCallback("codeFailure", () => {
      const reason: unknown = { code: "FOO" };
      throw reason;
    });

    await expect(dispatchBackendCallback(request("syncFailure", [])))
      .resolves.toMatchObject({ ok: false, error: { message: "sync failure" } });
    await expect(dispatchBackendCallback(request("asyncFailure", [])))
      .resolves.toMatchObject({ ok: false, error: { message: "async failure" } });
    await expect(dispatchBackendCallback(request("nullPrototypeFailure", [])))
      .resolves.toEqual({ ok: false, error: { message: "Unknown callback error." } });
    await expect(dispatchBackendCallback(request("codeFailure", [])))
      .resolves.toEqual({ ok: false, error: { message: '{"code":"FOO"}' } });
  });

  it("rejects a second registration of the same callback name", () => {
    registerBackendCallback("once", () => 1);
    expect(() => registerBackendCallback("once", () => 2)).toThrow('Backend callback "once" is already registered.');
  });

  it("keeps the renderer stack and attaches the backend stack as the cause", () => {
    const backendStack = "Error: backend failure\n    at backendCallback (backend.js:1:1)";
    let thrown: unknown;
    try {
      unwrapCallbackResponse({ ok: false, error: { message: "backend failure", stack: backendStack } });
    } catch (caught) {
      thrown = caught;
    }

    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe("backend failure");
    expect(error.stack).toContain("callbacks.test.ts");
    expect(error.stack).not.toContain("backend.js");
    expect((error.cause as Error).stack).toBe(backendStack);
  });

  it("rejects malformed callback responses at the renderer boundary", () => {
    expect(() => unwrapCallbackResponse({ ok: true })).toThrow("Invalid callback response");
    expect(() => unwrapCallbackResponse({ ok: false, error: {} })).toThrow("Invalid callback response");
  });

  it("accepts only the provider-owned WebContents and removes its handler", async () => {
    const ipcMain = new FakeIpcMain();
    registerBackendCallback("echo", (value: string) => value);
    const dispose = installElectronCallbackHandler(ipcMain, 42);
    const handler = ipcMain.handler;

    await expect(handler?.(eventFrom(42), request("echo", ["from provider"])))
      .resolves.toEqual({ ok: true, value: "from provider" });
    await expect(handler?.(eventFrom(7), request("echo", ["from another window"])))
      .rejects.toThrow("unexpected Electron browser window");

    registerBackendCallback("function", () => () => 1);
    await expect(handler?.(eventFrom(42), request("function", [])))
      .resolves.toMatchObject({ ok: false, error: { message: expect.stringContaining("cannot be sent over Electron IPC") } });

    dispose();
    dispose();
    expect(ipcMain.handledChannels).toEqual(["vitest-browser-bridge:callback"]);
    expect(ipcMain.removedChannels).toEqual(["vitest-browser-bridge:callback"]);
    expect(ipcMain.handler).toBeUndefined();
  });
});
