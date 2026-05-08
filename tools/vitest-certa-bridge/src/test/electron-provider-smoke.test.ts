/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";

type SendToBackend = (name: string, args: unknown[]) => Promise<unknown>;

function getSendToBackend(): SendToBackend {
  const candidate = (window as unknown as Record<string, unknown>)._CertaSendToBackend;
  expect(candidate).toBeTypeOf("function");
  return candidate as SendToBackend;
}

function getUserPreloadState() {
  return (window as unknown as Record<string, unknown>).__electronProviderUserPreload;
}

describe("Electron Vitest browser provider", () => {
  it("runs with real Vitest APIs in the Electron renderer", () => {
    const fn = vi.fn();
    fn("hello from electron");

    expect(fn).toHaveBeenCalledWith("hello from electron");
    expect(window.navigator.userAgent).toContain("Electron");
  });

  it("loads a consumer preload alongside the bridge preload", () => {
    expect(getUserPreloadState()).toEqual({
      loaded: true,
      processType: "renderer",
    });
  });

  it("calls backend callbacks from a real Vitest renderer test", async () => {
    const sendToBackend = getSendToBackend();

    await expect(sendToBackend("electron-provider:add", [2, 5])).resolves.toBe(7);
    await expect(sendToBackend("electron-provider:asyncEcho", ["from renderer"])).resolves.toEqual({ echoed: "from renderer" });
    await expect(sendToBackend("electron-provider:mainProcessInfo", [])).resolves.toMatchObject({
      appReady: true,
      processType: "browser",
    });
  });
});
