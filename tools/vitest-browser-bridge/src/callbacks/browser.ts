/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  CALLBACK_BRIDGE_GLOBAL,
  type CallbackRequest,
  unwrapCallbackResponse,
} from "./protocol.js";

interface BrowserCallbackBridge {
  invoke(request: CallbackRequest): unknown;
}

function isBrowserCallbackBridge(value: unknown): value is BrowserCallbackBridge {
  return typeof value === "object"
    && value !== null
    && "invoke" in value
    && typeof value.invoke === "function";
}

function getBrowserCallbackBridge(): BrowserCallbackBridge {
  const candidate = (globalThis as Record<string, unknown>)[CALLBACK_BRIDGE_GLOBAL];
  if (!isBrowserCallbackBridge(candidate))
    throw new Error(`The ${CALLBACK_BRIDGE_GLOBAL} preload bridge is not available.`);
  return candidate;
}

/** Invoke a named callback in the Electron main process.
 * @internal
 */
export async function invokeBackendCallback(name: string, ...args: unknown[]): Promise<unknown> {
  const response: unknown = await getBrowserCallbackBridge().invoke({ name, args });
  return unwrapCallbackResponse(response);
}
