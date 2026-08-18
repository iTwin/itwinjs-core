/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  CALLBACK_BRIDGE_GLOBAL,
  type CallbackRequest,
  type CallbackResponse,
  unwrapCallbackResponse,
} from "./protocol.js";

interface BrowserCallbackTransport {
  invoke(request: CallbackRequest): Promise<CallbackResponse>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getBrowserCallbackTransport(scope: object = globalThis): BrowserCallbackTransport {
  const candidate = (scope as Record<string, unknown>)[CALLBACK_BRIDGE_GLOBAL];
  if (!isRecord(candidate) || typeof candidate.invoke !== "function")
    throw new Error(`The ${CALLBACK_BRIDGE_GLOBAL} preload bridge is not available.`);

  return {
    invoke: candidate.invoke.bind(candidate) as BrowserCallbackTransport["invoke"],
  };
}

/** Invoke a legacy-style named callback in the Electron main process.
 *
 * Certa established this as a dynamic test-hook boundary: the runtime callback name does not
 * carry argument or result types between processes. This bridge preserves that contract while
 * keeping transported values `unknown` rather than allowing Certa's `any` to spread into callers.
 * @internal
 */
export async function invokeBackendCallback(name: string, ...args: unknown[]): Promise<unknown> {
  return unwrapCallbackResponse(await getBrowserCallbackTransport().invoke({ name, args }));
}
