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
import {
  backendCallbackTokenEnvVar, createBackendCallbackToken, createHttpBackendCallbackHandler, createHttpBackendCallbackInvoker,
  type HttpBackendCallbackRequest, readBackendCallbackToken,
} from "../callbacks/http.js";
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

const token = createBackendCallbackToken();
const tokenRequest = (name: string, args: readonly unknown[]) => ({ token, name, args });

async function httpResponse(body: unknown, overrides: Partial<HttpBackendCallbackRequest> = {}): Promise<Response> {
  let response: Response | undefined;
  await createHttpBackendCallbackHandler({ token })({
    body,
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  }, {
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

  it("requires an explicit value in successful responses at the renderer boundary", () => {
    expect(unwrapCallbackResponse({ ok: true, value: undefined })).toBeUndefined();
    expect(() => unwrapCallbackResponse({ ok: true })).toThrow("Invalid callback response");
    expect(() => unwrapCallbackResponse({ ok: "true" })).toThrow("Invalid callback response");
    expect(() => unwrapCallbackResponse({ ok: false, error: {} })).toThrow("Invalid callback response");
  });

  it("preserves an undefined callback result through the HTTP transport", async () => {
    registerBackendCallback("void", () => undefined);
    const invoke = createHttpBackendCallbackInvoker({
      token,
      url: "http://localhost/callback",
      fetch: async (_url, init) => {
        const response = await httpResponse(init?.body);
        expect(response.status).toBe(200);
        expect(await response.clone().json()).toEqual({ ok: true, undefined: true });
        return response;
      },
    });
    await expect(invoke("void")).resolves.toBeUndefined();
  });

  it.each(invalidJsonValues.map((value) => [value]))("rejects non-JSON HTTP arguments instead of silently changing them: %s", async (value) => {
    let called = false;
    registerBackendCallback("echo", (arg: unknown) => { called = true; return arg; });
    const invoke = createHttpBackendCallbackInvoker({
      token,
      url: "http://localhost/callback",
      fetch: async (_url, init) => httpResponse(init?.body),
    });
    await expect(invoke("echo", value)).rejects.toThrow("JSON values");
    expect(called).toBe(false);
  });

  it.each(invalidJsonValues.filter((value) => value !== undefined).map((value) => [value]))("returns an explicit error for non-JSON HTTP results: %s", async (value) => {
    registerBackendCallback("invalid", () => value);
    const response = await httpResponse(JSON.stringify(tokenRequest("invalid", [])));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, error: { message: expect.stringContaining("JSON values") } });
  });

  it("round-trips JSON arguments and results through the HTTP handler", async () => {
    registerBackendCallback("echo", (arg: unknown) => arg);
    const invoke = createHttpBackendCallbackInvoker({
      token,
      url: "http://localhost/callback",
      fetch: async (_url, init) => httpResponse(init?.body),
    });
    const value = { array: [null, false, 0, "text"], nested: { ok: true } };
    await expect(invoke("echo", value)).resolves.toEqual(value);
  });

  it("returns HTTP failures for malformed JSON, malformed requests, and callback errors", async () => {
    registerBackendCallback("fail", () => { throw new Error("callback failure"); });
    for (const body of ["{", { token, name: "fail", args: "invalid" }, tokenRequest("fail", [])]) {
      const response = await httpResponse(body);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ ok: false, error: { message: expect.any(String) } });
    }
  });

  it("allows only loopback callers that present the per-run token", async () => {
    let calls = 0;
    registerBackendCallback("count", () => ++calls);

    for (const remoteAddress of ["127.0.0.1", "::1", "::ffff:127.0.0.1"])
      expect((await httpResponse(tokenRequest("count", []), { socket: { remoteAddress } })).status).toBe(200);
    expect(calls).toBe(3);

    const rejected: [unknown, Partial<HttpBackendCallbackRequest>, string][] = [
      [tokenRequest("count", []), { socket: { remoteAddress: "192.168.1.20" } }, "caller address \"192.168.1.20\" is not a loopback address."],
      [tokenRequest("count", []), { socket: { remoteAddress: undefined } }, "caller address \"unknown\" is not a loopback address."],
      [request("count", []), {}, "missing or invalid callback token."],
      [{ ...tokenRequest("count", []), token: createBackendCallbackToken() }, {}, "missing or invalid callback token."],
      [{ ...tokenRequest("count", []), token: token.slice(1) }, {}, "missing or invalid callback token."],
      [JSON.stringify(["count"]), {}, "missing or invalid callback token."],
    ];
    for (const [body, overrides, message] of rejected) {
      const response = await httpResponse(body, overrides);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ ok: false, error: { message: `Backend callback rejected: ${message}` } });
    }
    expect(calls).toBe(3);
  });

  it("requires a per-run token on both sides of the HTTP transport", async () => {
    expect(() => createHttpBackendCallbackHandler({ token: "short" })).toThrow("An HTTP backend callback endpoint must provide a backend callback token");
    expect(readBackendCallbackToken({ [backendCallbackTokenEnvVar]: token })).toBe(token);
    expect(() => readBackendCallbackToken({})).toThrow(`${backendCallbackTokenEnvVar} must provide a backend callback token`);
    const invoke = createHttpBackendCallbackInvoker({ url: "http://localhost/callback", token: () => "", fetch: async () => new Response("{}") });
    await expect(invoke("add")).rejects.toThrow("The HTTP backend callback invoker must provide a backend callback token");
  });

  it("invokes callbacks through an HTTP transport", async () => {
    const invocations: RequestInit[] = [];
    const invoke = createHttpBackendCallbackInvoker({
      token,
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
      body: JSON.stringify({ token, name: "add", args: [2, 5] }),
    }]);
  });

  it("names the HTTP endpoint in malformed-response errors", async () => {
    for (const body of [{ ok: "true" }, { ok: true }, { ok: true, undefined: false }]) {
      const invoke = createHttpBackendCallbackInvoker({
        token,
        url: "http://localhost/callback",
        fetch: async () => new Response(JSON.stringify(body)),
      });
      await expect(invoke("malformed")).rejects.toThrow(/^Invalid callback response from the HTTP backend callback endpoint\.$/);
    }
  });

  it("unwraps callback failures through an HTTP transport", async () => {
    const invoke = createHttpBackendCallbackInvoker({
      token,
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
