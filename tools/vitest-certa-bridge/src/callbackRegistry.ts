/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { CertaBackendCallback } from "./types.js";

// Use a Symbol key so CJS and ESM module instances share the same callback map
// even across dual-package V8 contexts (avoids dual-package hazard with string keys).
const CALLBACKS_SYMBOL = Symbol.for("@itwin/vitest-certa-bridge/callbacks");

function getGlobalCallbacks(): { [name: string]: CertaBackendCallback } {
  if (!(globalThis as any)[CALLBACKS_SYMBOL])
    (globalThis as any)[CALLBACKS_SYMBOL] = {};
  return (globalThis as any)[CALLBACKS_SYMBOL];
}

/**
 * Returns the map of all registered backend callbacks.
 * @beta
 */
export function getCallbacksRegisteredOnBackend(): { [name: string]: CertaBackendCallback } {
  return getGlobalCallbacks();
}

/**
 * Registers a named callback that can be invoked from browser-side test code.
 * @beta
 */
export function registerBackendCallback(name: string, cb: CertaBackendCallback): void {
  getGlobalCallbacks()[name] = cb;
}

/**
 * Looks up and executes a registered callback by name. Throws if not found.
 * @internal
 */
export function executeRegisteredCallback(name: string, args: any[]): any {
  const callbacks = getGlobalCallbacks();
  if (!(name in callbacks))
    throw new Error(`Unknown certa backend callback "${name}"`);
  return callbacks[name](...args);
}

/**
 * Clears all registered callbacks. Used for test cleanup.
 * @internal
 */
export function clearCallbacks(): void {
  const callbacks = getGlobalCallbacks();
  for (const key of Object.keys(callbacks))
    delete callbacks[key];
}

/**
 * Validates the bridge token then executes the named callback.
 * Shared by the HTTP middleware (plugin.ts) and IPC handler (session.ts)
 * so token validation + dispatch logic stays in one place.
 * @internal
 */
export async function dispatchCallback(name: string, args: any[], token: string, expectedToken: string): Promise<any> {
  if (token !== expectedToken)
    throw new Error("Invalid bridge token");
  return executeRegisteredCallback(name, args);
}
