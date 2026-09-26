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

async function httpResponse(body: unknown): Promise<Response> {
  let response: Response | undefined;
  await createHttpBackendCallbackHandler()({ body }, {
    status: (status) => ({ json: (value) => { response = new Response(JSON.stringify(value), { status }); } }),
  });
  if (!response)
    throw new Error("HTTP callback handler did not respond.");
  return response;
}

const invalidJsonValues = [undefined, [undefined], { value: undefined }, NaN, Infinity, 1n, new Date(), new Map(), () => {}, Symbol("test")];

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
    const invoke = createHttpBackendCallbackInvoker({
      url: "http://localhost/callback",
      fetch: async (_url, init) => {
        const response = await httpResponse(init?.body);
        expect(response.status).toBe(200);
        return response;
      },
    });
    await expect(invoke("void")).resolves.toBeUndefined();
  });

  it.each(invalidJsonValues.map((value) => [value]))("rejects non-JSON HTTP arguments instead of silently changing them: %s", async (value) => {
    let called = false;
    registerBackendCallback("echo", (arg: unknown) => { called = true; return arg; });
    const invoke = createHttpBackendCallbackInvoker({
      url: "http://localhost/callback",
      fetch: async (_url, init) => httpResponse(init?.body),
    });
    await expect(invoke("echo", value)).rejects.toThrow("JSON values");
    expect(called).toBe(false);
  });

  it.each(invalidJsonValues.filter((value) => value !== undefined).map((value) => [value]))("returns an explicit error for non-JSON HTTP results: %s", async (value) => {
    registerBackendCallback("invalid", () => value);
    const response = await httpResponse(JSON.stringify(request("invalid", [])));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, error: { message: expect.stringContaining("JSON values") } });
  });

  it("round-trips JSON arguments and results through the HTTP handler", async () => {
    registerBackendCallback("echo", (arg: unknown) => arg);
    const invoke = createHttpBackendCallbackInvoker({
      url: "http://localhost/callback",
      fetch: async (_url, init) => httpResponse(init?.body),
    });
    const value = { array: [null, false, 0, "text"], nested: { ok: true } };
    await expect(invoke("echo", value)).resolves.toEqual(value);
  });

  it("returns HTTP failures for malformed JSON, malformed requests, and callback errors", async () => {
    registerBackendCallback("fail", () => { throw new Error("callback failure"); });
    for (const body of ["{", { name: "fail", args: "invalid" }, request("fail", [])]) {
      const response = await httpResponse(body);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ ok: false, error: { message: expect.any(String) } });
    }
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
