/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { CertaBackendCallback } from "./types.js";

// Use globalThis as the single source of truth so CJS and ESM module
// instances share the same callback map (avoids dual-package hazard).
function getGlobalCallbacks(): { [name: string]: CertaBackendCallback } {
  if (!(globalThis as any)._CertaRegisteredCallbacks)
    (globalThis as any)._CertaRegisteredCallbacks = {};
  return (globalThis as any)._CertaRegisteredCallbacks;
}

/** Returns the map of all registered backend callbacks. */
export function getCallbacksRegisteredOnBackend(): { [name: string]: CertaBackendCallback } {
  return getGlobalCallbacks();
}

/** Registers a named callback that can be invoked from browser-side test code. */
export function registerBackendCallback(name: string, cb: CertaBackendCallback): void {
  getGlobalCallbacks()[name] = cb;
}

/** Looks up and executes a registered callback by name. Throws if not found. */
export function executeRegisteredCallback(name: string, args: any[]): any {
  const callbacks = getGlobalCallbacks();
  if (!(name in callbacks))
    throw new Error(`Unknown certa backend callback "${name}"`);
  return callbacks[name](...args);
}

/** Clears all registered callbacks. Used for test cleanup. */
export function clearCallbacks(): void {
  const callbacks = getGlobalCallbacks();
  for (const key of Object.keys(callbacks))
    delete callbacks[key];
}
