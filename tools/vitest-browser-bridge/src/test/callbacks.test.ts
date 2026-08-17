/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearBackendCallbacks,
  dispatchBackendCallback,
  getRegisteredBackendCallbackNames,
  registerBackendCallback,
} from "../callbacks/backend.js";
import {
  createCallbackInvocation,
  createCallbackRequest,
} from "../callbacks/protocol.js";
import { installElectronCallbackHandler } from "../callbacks/electron.js";

class FakeIpcMain {
  public handler?: (event: unknown, payload: unknown) => Promise<unknown>;
  public removedChannels: string[] = [];

  public handle(_channel: string, listener: (event: unknown, payload: unknown) => Promise<unknown>): void {
    this.handler = listener;
  }

  public removeHandler(channel: string): void {
    this.removedChannels.push(channel);
    this.handler = undefined;
  }
}

describe("callback transport", () => {
  beforeEach(() => clearBackendCallbacks());

  it("validates the method, name, payload, and per-run token", async () => {
    registerBackendCallback("add", (a: number, b: number) => a + b);
    const validRequest = createCallbackRequest("run-token", createCallbackInvocation("add", [2, 5]));

    await expect(dispatchBackendCallback(validRequest, "run-token")).resolves.toEqual({ ok: true, value: 7 });
    await expect(dispatchBackendCallback({ ...validRequest, method: "other" }, "run-token")).resolves.toMatchObject({
      ok: false,
      error: { message: "Invalid callback method: other." },
    });
    await expect(dispatchBackendCallback({ ...validRequest, args: "not-an-array" }, "run-token")).resolves.toMatchObject({
      ok: false,
      error: { message: "Callback arguments must be an array." },
    });
    await expect(dispatchBackendCallback({ ...validRequest, token: "other-token" }, "run-token")).resolves.toMatchObject({
      ok: false,
      error: { message: "Invalid callback token." },
    });
  });

  it("serializes synchronous throws and asynchronous rejections", async () => {
    registerBackendCallback("syncFailure", () => {
      throw new Error("sync failure");
    });
    registerBackendCallback("asyncFailure", async () => {
      throw new Error("async failure");
    });

    await expect(dispatchBackendCallback(createCallbackRequest("token", createCallbackInvocation("syncFailure", [])), "token"))
      .resolves.toMatchObject({ ok: false, error: { message: "sync failure", name: "Error" } });
    await expect(dispatchBackendCallback(createCallbackRequest("token", createCallbackInvocation("asyncFailure", [])), "token"))
      .resolves.toMatchObject({ ok: false, error: { message: "async failure", name: "Error" } });
  });

  it("clears callbacks and removes the IPC handler during teardown", async () => {
    const ipcMain = new FakeIpcMain();
    registerBackendCallback("echo", (value: string) => value);
    const dispose = installElectronCallbackHandler(ipcMain, "token");
    const handler = ipcMain.handler;

    await expect(handler?.({}, createCallbackRequest("token", createCallbackInvocation("echo", ["before teardown"]))))
      .resolves.toEqual({ ok: true, value: "before teardown" });
    dispose();
    dispose();

    expect(ipcMain.removedChannels).toEqual(["vitest-browser-bridge:callback"]);
    expect(getRegisteredBackendCallbackNames()).toEqual([]);
    await expect(handler?.({}, createCallbackRequest("token", createCallbackInvocation("echo", ["after teardown"]))))
      .resolves.toMatchObject({ ok: false, error: { message: 'Unknown backend callback "echo".' } });
  });
});
