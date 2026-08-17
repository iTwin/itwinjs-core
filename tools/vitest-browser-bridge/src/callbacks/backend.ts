/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  assertCallbackArguments,
  assertCallbackName,
  callbackFailed,
  type CallbackResponse,
  callbackSucceeded,
  parseCallbackRequest,
} from "./protocol.js";

/** A callback registered by an Electron main-process test fixture.
 * @internal
 */
export type BackendCallback = (...args: never[]) => unknown;

interface BackendCallbackState {
  readonly callbacks: Record<string, BackendCallback>;
}

const CALLBACKS_SYMBOL = Symbol.for("@itwin/vitest-browser-bridge/backend-callbacks");

function getState(): BackendCallbackState {
  const globalState = globalThis as typeof globalThis & {
    [CALLBACKS_SYMBOL]?: BackendCallbackState;
  };
  if (globalState[CALLBACKS_SYMBOL] === undefined)
    globalState[CALLBACKS_SYMBOL] = { callbacks: Object.create(null) as Record<string, BackendCallback> };
  return globalState[CALLBACKS_SYMBOL];
}

/** Register one explicitly named test callback in the current backend process.
 * @internal
 */
export function registerBackendCallback<Arguments extends readonly unknown[]>(name: string, callback: (...args: Arguments) => unknown): void {
  assertCallbackName(name);
  if (typeof callback !== "function")
    throw new Error(`Callback "${name}" must be a function.`);
  getState().callbacks[name] = callback;
}

/** Return the names currently registered in the backend callback table.
 * @internal
 */
export function getRegisteredBackendCallbackNames(): readonly string[] {
  return Object.keys(getState().callbacks);
}

/** Remove every callback during provider-session teardown.
 * @internal
 */
export function clearBackendCallbacks(): void {
  const callbacks = getState().callbacks;
  for (const name of Object.keys(callbacks))
    delete callbacks[name];
}

/** Invoke one registered callback after validating its method name and argument payload.
 * @internal
 */
export async function invokeRegisteredBackendCallback(name: string, args: readonly unknown[]): Promise<unknown> {
  assertCallbackName(name);
  assertCallbackArguments(args);
  const callback = getState().callbacks[name];
  if (callback === undefined)
    throw new Error(`Unknown backend callback "${name}".`);
  return (callback as (...callbackArgs: readonly unknown[]) => unknown)(...args);
}

/** Dispatch one token-validated callback request and serialize success or failure.
 * @internal
 */
export async function dispatchBackendCallback(payload: unknown, expectedToken: string): Promise<CallbackResponse> {
  try {
    const request = parseCallbackRequest(payload, expectedToken);
    return callbackSucceeded(await invokeRegisteredBackendCallback(request.name, request.args));
  } catch (error) {
    return callbackFailed(error);
  }
}

