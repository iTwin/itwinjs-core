/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { CertaBackendCallback } from "./types";

const callbacks: { [name: string]: CertaBackendCallback } = {};

function syncToGlobal(): void {
  (global as any)._CertaRegisteredCallbacks = callbacks;
}

/** Returns the map of all registered backend callbacks. */
export function getCallbacksRegisteredOnBackend(): { [name: string]: CertaBackendCallback } {
  syncToGlobal();
  return callbacks;
}

/** Registers a named callback that can be invoked from browser-side test code. */
export function registerBackendCallback(name: string, cb: CertaBackendCallback): void {
  callbacks[name] = cb;
  syncToGlobal();
}

/** Looks up and executes a registered callback by name. Throws if not found. */
export function executeRegisteredCallback(name: string, args: any[]): any {
  if (!(name in callbacks))
    throw new Error(`Unknown certa backend callback "${name}"`);
  return callbacks[name](...args);
}

/** Clears all registered callbacks. Used for test cleanup. */
export function clearCallbacks(): void {
  for (const key of Object.keys(callbacks))
    delete callbacks[key];
  syncToGlobal();
}
