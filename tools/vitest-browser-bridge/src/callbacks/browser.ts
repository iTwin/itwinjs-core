/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { inject } from "vitest";
import { backendOriginFor } from "../ports.js";
import { backendCallbackPath, backendCallbackTokenKey, createHttpBackendCallbackInvoker } from "./http.js";
import {
  assertJsonValue,
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

function readProvidedToken(): string {
  // The bridge cannot declare Vitest's ProvidedContext type, so consumers declare this key themselves.
  const token = (inject as (key: string) => unknown)(backendCallbackTokenKey);
  if (typeof token !== "string")
    throw new Error(`No backend callback token was provided. Vitest's global setup must call project.provide("${backendCallbackTokenKey}", token).`);
  return token;
}

async function invokeOverHttp(name: string, args: readonly unknown[]): Promise<unknown> {
  return createHttpBackendCallbackInvoker({
    url: `${backendOriginFor(globalThis.location)}${backendCallbackPath}`,
    token: readProvidedToken(),
  })(name, ...args);
}

/** Invoke a named callback in the test backend from a browser test.
 * Electron pages use the bridge preload's IPC channel. Other browsers use the backend's HTTP callback
 * endpoint at `backendCallbackPath`, with the per-run token provided by Vitest's global setup.
 * Arguments and results must be JSON values in both runtimes, so a callback that works in one works in the other.
 * @internal
 */
export async function invokeBackendCallback(name: string, ...args: unknown[]): Promise<unknown> {
  assertJsonValue({ name, args });
  const bridge = (globalThis as Record<string, unknown>)[CALLBACK_BRIDGE_GLOBAL];
  if (isBrowserCallbackBridge(bridge)) {
    const value = unwrapCallbackResponse(await bridge.invoke({ name, args }));
    if (value !== undefined)
      assertJsonValue(value);
    return value;
  }
  if (globalThis.navigator?.userAgent.includes("Electron"))
    throw new Error(`The ${CALLBACK_BRIDGE_GLOBAL} preload bridge is not available in this Electron page.`);
  return invokeOverHttp(name, args);
}
