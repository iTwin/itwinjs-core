/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Electron main-process helper for the vitest-certa-bridge.
// Registers async IPC handlers so renderer-side `executeBackendCallback` works
// via `ipcRenderer.invoke` instead of HTTP fetch.

import * as crypto from "crypto";
import { executeRegisteredCallback } from "./callbackRegistry.js";

export interface ElectronBridgeOptions {
  /** Path to the backend init module. Loaded via `require()` in main process. */
  backendInitModule?: string;
  /** Override the ipcMain module (for testing). If not provided, requires `electron`. */
  ipcMain?: { handle: (channel: string, listener: (...args: any[]) => any) => void };
}

/**
 * Initializes the Electron IPC bridge for backend callbacks.
 * Call this in the Electron main process before creating BrowserWindows.
 *
 * Returns a session token that must be injected into each renderer
 * (e.g. via `webContents.executeJavaScript`) so `_CertaSendToBackend` can authenticate.
 */
export async function initElectronBridge(options: ElectronBridgeOptions = {}): Promise<{ token: string }> {
  // Use injected ipcMain or lazy-require electron
  const ipcMain = options.ipcMain ?? require("electron").ipcMain; // eslint-disable-line @typescript-eslint/no-require-imports

  // Per-session token prevents rogue renderers from calling backend callbacks
  const token = crypto.randomUUID();

  // Load backend init module (registers callbacks into the global registry)
  if (options.backendInitModule) {
    const initResult = require(options.backendInitModule); // eslint-disable-line @typescript-eslint/no-require-imports
    // If the module exports a promise (e.g. async init), await it
    if (initResult && typeof initResult.then === "function")
      await initResult;
  }

  // Register async IPC handler — renderer calls via ipcRenderer.invoke("certa-callback", ...)
  ipcMain.handle("certa-callback", async (_event: any, payload: { token: string; name: string; args: any[] }) => {
    try {
      if (payload.token !== token)
        throw new Error("Invalid bridge token");

      const result = await executeRegisteredCallback(payload.name, payload.args);
      return { result };
    } catch (err: any) {
      return { error: { message: err.message, stack: err.stack } };
    }
  });

  return { token };
}

/**
 * Generates the JavaScript snippet to inject into a BrowserWindow renderer.
 * Sets up `window._CertaSendToBackend` so the shared `executeBackendCallback` client works via IPC.
 */
export function getRendererShimScript(token: string): string {
  return `
    (function() {
      const { ipcRenderer } = require("electron");
      // Async IPC bridge: renderer -> main process callback execution
      window._CertaSendToBackend = async function(name, args) {
        const response = await ipcRenderer.invoke("certa-callback", {
          token: ${JSON.stringify(token)},
          name: name,
          args: args
        });
        if (response.error) {
          const err = new Error(response.error.message);
          if (response.error.stack) err.stack = response.error.stack;
          throw err;
        }
        return response.result;
      };
      window.__CERTA_BRIDGE_TOKEN__ = ${JSON.stringify(token)};
    })();
  `;
}
