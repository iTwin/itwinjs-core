/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  CALLBACK_BRIDGE_GLOBAL,
  type CallbackInvocation,
  type CallbackResponse,
  createCallbackInvocation,
  unwrapCallbackResponse,
} from "./protocol.js";

/** The transport exposed by the Electron preload in the renderer global scope.
 * @internal
 */
export interface BrowserCallbackTransport {
  invoke(invocation: CallbackInvocation): Promise<CallbackResponse>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Find and validate the context-isolated callback transport without importing Electron.
 * @internal
 */
export function getBrowserCallbackTransport(scope: object = globalThis): BrowserCallbackTransport {
  const candidate = (scope as Record<string, unknown>)[CALLBACK_BRIDGE_GLOBAL];
  if (!isRecord(candidate) || typeof candidate.invoke !== "function")
    throw new Error(`The ${CALLBACK_BRIDGE_GLOBAL} preload bridge is not available.`);

  return {
    invoke: candidate.invoke.bind(candidate) as BrowserCallbackTransport["invoke"],
  };
}

/** Invoke a named backend callback from a renderer test.
 * @internal
 */
export async function invokeBackendCallback(name: string, args: readonly unknown[] = [], transport?: BrowserCallbackTransport): Promise<unknown> {
  const invocation = createCallbackInvocation(name, args);
  const response = await (transport ?? getBrowserCallbackTransport()).invoke(invocation);
  return unwrapCallbackResponse(response);
}
