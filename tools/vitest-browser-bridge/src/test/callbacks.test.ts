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
import { createHttpBackendCallbackHandler, createHttpBackendCallbackInvoker } from "../callbacks/http.js";
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

    await expect(dispatchBackendCallback(request("syncFailure", [])))
      .resolves.toMatchObject({ ok: false, error: { message: "sync failure" } });
    await expect(dispatchBackendCallback(request("asyncFailure", [])))
      .resolves.toMatchObject({ ok: false, error: { message: "async failure" } });
    await expect(dispatchBackendCallback(request("nullPrototypeFailure", [])))
      .resolves.toEqual({ ok: false, error: { message: "Unknown callback error." } });
  });

  it("preserves a successful undefined callback result at the renderer boundary", () => {
    expect(unwrapCallbackResponse({ ok: true })).toBeUndefined();
    expect(() => unwrapCallbackResponse({ ok: "true" })).toThrow("Invalid callback response");
    expect(() => unwrapCallbackResponse({ ok: false, error: {} })).toThrow("Invalid callback response");
  });

  it("preserves an undefined callback result through the HTTP transport", async () => {
    registerBackendCallback("void", () => undefined);
    let serializedResponse: string | undefined;
    const handler = createHttpBackendCallbackHandler();
    await handler(
      { body: request("void", []) },
      {
        status: (statusCode) => ({
          json: (body) => {
            expect(statusCode).toBe(200);
            serializedResponse = JSON.stringify(body);
          },
        }),
      },
    );

    const invoke = createHttpBackendCallbackInvoker({
      url: "http://localhost/callback",
      fetch: async () => new Response(serializedResponse, { status: 200 }),
    });
    await expect(invoke("void")).resolves.toBeUndefined();
  });

  it("invokes callbacks through an HTTP transport", async () => {
    const invocations: RequestInit[] = [];
    const invoke = createHttpBackendCallbackInvoker({
      url: () => "http://localhost/callback",
      fetch: async (url, init) => {
        expect(url).toBe("http://localhost/callback");
        invocations.push(init ?? {});
        return new Response(JSON.stringify({ ok: true, value: 7 }));
      },
    });

    await expect(invoke("add", 2, 5)).resolves.toBe(7);
    expect(invocations).toEqual([{
      method: "POST",
      body: JSON.stringify({ name: "add", args: [2, 5] }),
    }]);
  });

  it("unwraps callback failures through an HTTP transport", async () => {
    const invoke = createHttpBackendCallbackInvoker({
      url: "http://localhost/callback",
      fetch: async () => new Response(JSON.stringify({ ok: false, error: { message: "failed" } }), { status: 500 }),
    });

    await expect(invoke("fail")).rejects.toThrow("failed");
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

    dispose();
    dispose();
    expect(ipcMain.handledChannels).toEqual(["vitest-browser-bridge:callback"]);
    expect(ipcMain.removedChannels).toEqual(["vitest-browser-bridge:callback"]);
    expect(ipcMain.handler).toBeUndefined();
  });
});
