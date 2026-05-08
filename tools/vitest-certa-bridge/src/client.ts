/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { BridgeResponse } from "./types.js";

// Memoize transport detection so the check runs once at first call.
let _resolvedTransport: "electron" | "http" | undefined;
function getBridgeTransport(): "electron" | "http" {
  return (_resolvedTransport ??= typeof (globalThis as any)._CertaSendToBackend === "function" ? "electron" : "http");
}

/**
 * Browser-side function that calls a named backend callback.
 * Uses IPC via `_CertaSendToBackend` when available (Electron), otherwise falls back to
 * HTTP via the Vite dev server `/__certa_bridge` middleware (Chrome/Playwright).
 * @beta
 */
export async function executeBackendCallback(name: string, ...args: any[]): Promise<any> {
  if (getBridgeTransport() === "electron")
    return (globalThis as any)._CertaSendToBackend(name, args);

  // Chrome/Vitest browser mode: HTTP fetch to Vite dev server middleware
  const token = (globalThis as any).__CERTA_BRIDGE_TOKEN__ ?? "";
  const response = await fetch("/__certa_bridge", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-certa-bridge-token": token },
    body: JSON.stringify({ name, args }),
  });

  if (!response.ok) {
    throw new Error(`Bridge request failed with status ${response.status}`);
  }

  const data: BridgeResponse = await response.json();
  if (data.error) {
    const err = new Error(data.error.message);
    if (data.error.stack)
      err.stack = data.error.stack;
    throw err;
  }

  return data.result;
}
