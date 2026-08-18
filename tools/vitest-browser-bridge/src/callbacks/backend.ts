/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  assertCallbackName,
  type CallbackResponse,
  captureCallbackResponse,
  parseCallbackRequest,
} from "./protocol.js";

/** A callback stored after its registration-site argument types have been erased.
 * @internal
 */
type BackendCallback = (...args: never[]) => unknown;

interface BackendCallbackState {
  readonly callbacks: Map<string, BackendCallback>;
}

const CALLBACKS_SYMBOL = Symbol.for("@itwin/vitest-browser-bridge/backend-callbacks");

function getState(): BackendCallbackState {
  const globalState = globalThis as typeof globalThis & {
    [CALLBACKS_SYMBOL]?: BackendCallbackState;
  };
  if (globalState[CALLBACKS_SYMBOL] === undefined)
    globalState[CALLBACKS_SYMBOL] = { callbacks: new Map() };
  return globalState[CALLBACKS_SYMBOL];
}

/** Register one explicitly named test callback in the current backend process.
 *
 * This intentionally retains Certa's dynamic, name-based callback model for migration
 * compatibility. Argument types help the registration site, but are erased at the process
 * boundary because a runtime callback name cannot establish their types for the renderer.
 * @internal
 */
export function registerBackendCallback<Arguments extends readonly unknown[]>(name: string, callback: (...args: Arguments) => unknown): void {
  assertCallbackName(name);
  if (typeof callback !== "function")
    throw new Error(`Callback "${name}" must be a function.`);
  getState().callbacks.set(name, callback);
}

/** Remove every callback during provider-session teardown.
 * @internal
 */
export function clearBackendCallbacks(): void {
  getState().callbacks.clear();
}

/** Invoke one registered callback after its request has crossed the validated IPC boundary.
 * @internal
 */
async function invokeRegisteredBackendCallback(name: string, args: readonly unknown[]): Promise<unknown> {
  const callback = getState().callbacks.get(name);
  if (callback === undefined)
    throw new Error(`Unknown backend callback "${name}".`);
  return (callback as (...callbackArgs: readonly unknown[]) => unknown)(...args);
}

/** Dispatch one callback request without surfacing expected test failures as Electron IPC errors.
 * @internal
 */
export async function dispatchBackendCallback(payload: unknown): Promise<CallbackResponse> {
  return captureCallbackResponse(async () => {
    const request = parseCallbackRequest(payload);
    return invokeRegisteredBackendCallback(request.name, request.args);
  });
}
