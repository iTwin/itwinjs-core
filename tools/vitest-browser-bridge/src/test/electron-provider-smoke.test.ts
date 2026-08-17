/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { invokeBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/browser";

describe("Vitest Electron BrowserProvider", () => {
  it("runs real Vitest APIs in an Electron renderer", () => {
    const spy = vi.fn((value: string) => value.toUpperCase());
    expect(spy("renderer")).toBe("RENDERER");
    expect(spy).toHaveBeenCalledWith("renderer");
    expect(window.navigator.userAgent).toContain("Electron");
  });

  it("keeps Node integration disabled while exposing the composed preload", () => {
    expect("require" in window).toBe(false);
    expect("process" in window).toBe(false);
    expect((globalThis as Record<string, unknown>).__vitestBrowserBridgeUserPreload).toEqual({
      loaded: true,
      processType: "renderer",
    });
  });

  it("invokes successful, asynchronous, and failing backend callbacks", async () => {
    await expect(invokeBackendCallback("provider:add", [2, 5])).resolves.toBe(7);
    await expect(invokeBackendCallback("provider:asyncEcho", ["from renderer"])).resolves.toEqual({ echoed: "from renderer" });
    await expect(invokeBackendCallback("provider:failure", [])).rejects.toThrow("intentional callback failure");
    await expect(invokeBackendCallback("provider:missing", [])).rejects.toThrow('Unknown backend callback "provider:missing".');
  });

  it("can call a backend callback in the Electron main process", async () => {
    await expect(invokeBackendCallback("provider:mainProcessInfo", [])).resolves.toMatchObject({
      appReady: true,
      processType: "browser",
    });
  });
});
