/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, inject, it, vi } from "vitest";
import { clearBackendCallbacks, dispatchBackendCallback, registerBackendCallback } from "../callbacks/backend.js";
import { invokeBackendCallback } from "../callbacks/browser.js";
import { CALLBACK_BRIDGE_GLOBAL, type CallbackRequest } from "../callbacks/protocol.js";

describe("invokeBackendCallback", () => {
  beforeEach(() => {
    clearBackendCallbacks();
    registerBackendCallback("add", (a: number, b: number) => a + b);
    registerBackendCallback("date", () => new Date());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearBackendCallbacks();
  });

  it("uses the Electron preload bridge when it is present", async () => {
    const requests: CallbackRequest[] = [];
    vi.stubGlobal(CALLBACK_BRIDGE_GLOBAL, {
      invoke: async (request: CallbackRequest) => {
        requests.push(request);
        return dispatchBackendCallback(request);
      },
    });

    await expect(invokeBackendCallback("add", 2, 5)).resolves.toBe(7);
    expect(requests).toEqual([{ name: "add", args: [2, 5] }]);
  });

  it("applies the HTTP value rules in Electron too", async () => {
    const invoke = vi.fn(async (request: CallbackRequest) => dispatchBackendCallback(request));
    vi.stubGlobal(CALLBACK_BRIDGE_GLOBAL, { invoke });

    await expect(invokeBackendCallback("add", new Date(), 1)).rejects.toThrow("JSON values");
    expect(invoke).not.toHaveBeenCalled();
    await expect(invokeBackendCallback("date")).rejects.toThrow("JSON values");
  });

  it("fails clearly in an Electron page without the preload bridge", async () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Chrome/140.0 Electron/44.4.5" });
    await expect(invokeBackendCallback("add", 2, 5)).rejects.toThrow(`The ${CALLBACK_BRIDGE_GLOBAL} preload bridge is not available in this Electron page.`);
  });

  it("calls the backend's HTTP endpoint with the provided token in other browsers", async () => {
    vi.stubGlobal("location", { protocol: "http:", hostname: "localhost", port: "3020" });
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const response = await dispatchBackendCallback(JSON.parse(init.body as string));
      return new Response(JSON.stringify(response));
    });
    vi.stubGlobal("fetch", fetch);

    await expect(invokeBackendCallback("add", 2, 5)).resolves.toBe(7);
    expect(fetch).toHaveBeenCalledWith("http://localhost:5020/__vitest_backend_callback", {
      method: "POST",
      body: JSON.stringify({ token: (inject as (key: string) => unknown)("backendCallbackToken"), name: "add", args: [2, 5] }),
    });
  });
});
