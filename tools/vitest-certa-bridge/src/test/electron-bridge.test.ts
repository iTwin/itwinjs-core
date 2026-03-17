/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerBackendCallback, clearCallbacks, getCallbacksRegisteredOnBackend } from "../callbackRegistry.js";
import { initElectronBridge, getRendererShimScript } from "../electron-main.js";

// Fake ipcMain for testing (no real Electron needed)
function createMockIpcMain() {
  const handlers: Record<string, (...args: any[]) => any> = {};
  return {
    handle: vi.fn((channel: string, listener: (...args: any[]) => any) => {
      handlers[channel] = listener;
    }),
    getHandler: (channel: string) => handlers[channel],
  };
}

describe("electron-main bridge", () => {
  let mockIpcMain: ReturnType<typeof createMockIpcMain>;

  beforeEach(() => {
    clearCallbacks();
    mockIpcMain = createMockIpcMain();
  });

  afterEach(() => {
    clearCallbacks();
  });

  it("should return a session token", async () => {
    const { token } = await initElectronBridge({ ipcMain: mockIpcMain });
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("should register an ipcMain.handle for 'certa-callback'", async () => {
    await initElectronBridge({ ipcMain: mockIpcMain });
    expect(mockIpcMain.handle).toHaveBeenCalledWith("certa-callback", expect.any(Function));
  });

  it("should load backendInitModule when specified", async () => {
    registerBackendCallback("testCallback", () => "hello from backend");

    const { token } = await initElectronBridge({ ipcMain: mockIpcMain });
    expect(token).toBeTruthy();
    expect(getCallbacksRegisteredOnBackend()["testCallback"]).toBeDefined();
  });

  it("should reject calls with invalid token", async () => {
    registerBackendCallback("testCallback", () => "ok");

    await initElectronBridge({ ipcMain: mockIpcMain });
    const handler = mockIpcMain.getHandler("certa-callback");

    const result = await handler(null, { token: "wrong-token", name: "testCallback", args: [] });
    expect(result.error).toBeDefined();
    expect(result.error.message).toContain("Invalid bridge token");
  });

  it("should execute callbacks with valid token", async () => {
    registerBackendCallback("testCallback", (a: number, b: number) => a + b);

    const { token } = await initElectronBridge({ ipcMain: mockIpcMain });
    const handler = mockIpcMain.getHandler("certa-callback");

    const result = await handler(null, { token, name: "testCallback", args: [3, 4] });
    expect(result.result).toBe(7);
    expect(result.error).toBeUndefined();
  });

  it("should return error for unknown callbacks", async () => {
    const { token } = await initElectronBridge({ ipcMain: mockIpcMain });
    const handler = mockIpcMain.getHandler("certa-callback");

    const result = await handler(null, { token, name: "nonExistent", args: [] });
    expect(result.error).toBeDefined();
    expect(result.error.message).toContain('Unknown certa backend callback "nonExistent"');
  });

  it("should handle async callbacks", async () => {
    registerBackendCallback("asyncCallback", async (x: number) => x * 2);

    const { token } = await initElectronBridge({ ipcMain: mockIpcMain });
    const handler = mockIpcMain.getHandler("certa-callback");

    const result = await handler(null, { token, name: "asyncCallback", args: [5] });
    expect(result.result).toBe(10);
  });

  describe("getRendererShimScript", () => {
    it("should return a string containing the token", () => {
      const script = getRendererShimScript("test-token-123");
      expect(script).toContain("test-token-123");
      expect(script).toContain("_CertaSendToBackend");
      expect(script).toContain("ipcRenderer.invoke");
      expect(script).toContain("__CERTA_BRIDGE_TOKEN__");
    });
  });
});
