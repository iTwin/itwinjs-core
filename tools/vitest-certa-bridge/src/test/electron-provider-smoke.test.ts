/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _CertaSendToBackend: (name: string, args: unknown[]) => Promise<unknown>;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __electronProviderUserPreload: { loaded: boolean; processType: string };
  }
}

describe("Electron Vitest browser provider", () => {
  it("runs with real Vitest APIs in the Electron renderer", () => {
    const fn = vi.fn();
    fn("hello from electron");

    expect(fn).toHaveBeenCalledWith("hello from electron");
    expect(window.navigator.userAgent).toContain("Electron");
  });

  it("loads a consumer preload alongside the bridge preload", () => {
    expect(window.__electronProviderUserPreload).toEqual({
      loaded: true,
      processType: "renderer",
    });
  });

  it("calls backend callbacks from a real Vitest renderer test", async () => {
    await expect(window._CertaSendToBackend("electron-provider:add", [2, 5])).resolves.toBe(7);
    await expect(window._CertaSendToBackend("electron-provider:asyncEcho", ["from renderer"])).resolves.toEqual({ echoed: "from renderer" });
    await expect(window._CertaSendToBackend("electron-provider:mainProcessInfo", [])).resolves.toMatchObject({
      appReady: true,
      processType: "browser",
    });
  });
});
