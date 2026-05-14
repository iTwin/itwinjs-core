/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** A callback function that can be registered on the backend and invoked from browser-side test code. */
type CertaBackendCallback = (...args: any[]) => unknown;

// Use a Symbol key so CJS and ESM module instances share the same callback map
// even across dual-package V8 contexts (avoids dual-package hazard with string keys).
const CALLBACKS_SYMBOL = Symbol.for("@itwin/vitest-certa-bridge/callbacks");

function getGlobalCallbacks(): { [name: string]: CertaBackendCallback } {
  if (!(globalThis as any)[CALLBACKS_SYMBOL])
    (globalThis as any)[CALLBACKS_SYMBOL] = Object.create(null);
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
 *
 * Registered callbacks are intentionally privileged test hooks: renderer tests can ask the
 * Electron main process to execute only callbacks that the test backend explicitly registered.
 * Keep callbacks narrow and test-only; do not load this provider against untrusted content.
 *
 * @beta
 */
export function registerBackendCallback(name: string, cb: CertaBackendCallback): void {
  if (!name)
    throw new Error("Backend callback name must be a non-empty string.");
  if (typeof cb !== "function")
    throw new Error(`Backend callback "${name}" must be a function.`);
  getGlobalCallbacks()[name] = cb;
}

/**
 * Looks up and executes a registered callback by name. Throws if not found.
 * @internal
 */
export function executeRegisteredCallback(name: string, args: any[]): any {
  const callbacks = getGlobalCallbacks();
  if (!Object.prototype.hasOwnProperty.call(callbacks, name))
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
 * Validates the per-session bridge token then executes the named callback.
 *
 * This is not a general RPC endpoint. The provider creates a random token for each Electron
 * session, closes over it in the generated preload, and accepts calls only with that token.
 * That prevents arbitrary page script from directly invoking the IPC handler; test code can
 * still call explicitly registered backend callbacks through the preload by design.
 *
 * @internal
 */
export async function dispatchCallback(name: string, args: any[], token: string, expectedToken: string): Promise<any> {
  if (token !== expectedToken)
    throw new Error("Invalid bridge token");
  if (!Array.isArray(args))
    throw new Error("Backend callback arguments must be an array.");
  return executeRegisteredCallback(name, args);
}
