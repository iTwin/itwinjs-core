/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { dispatchBackendCallback } from "./backend.js";
import { type CallbackRequest, unwrapCallbackResponse } from "./protocol.js";

export interface HttpBackendCallbackInvokerOptions {
  readonly url: string | (() => string);
  readonly fetch?: typeof globalThis.fetch;
}

export type BackendCallbackInvoker = (name: string, ...args: readonly unknown[]) => Promise<unknown>;

/** The request shape needed by an HTTP callback endpoint handler.
 * @internal
 */
export interface HttpBackendCallbackRequest {
  readonly body: unknown;
}

/** The response shape needed by an HTTP callback endpoint handler.
 * @internal
 */
export interface HttpBackendCallbackResponse {
  status(statusCode: number): {
    json(body: unknown): unknown;
  };
}

function assertJsonValue(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)))
    return;

  if (typeof value !== "object" || ancestors.has(value)
    || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    || Object.getOwnPropertySymbols(value).length > 0)
    throw new TypeError("HTTP backend callback arguments and defined results must contain only JSON values.");

  ancestors.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value))
    assertJsonValue(item, ancestors);
  ancestors.delete(value);
}

/** Create a framework-neutral handler for an HTTP backend callback endpoint.
 * @internal
 */
export function createHttpBackendCallbackHandler() {
  return async (request: HttpBackendCallbackRequest, response: HttpBackendCallbackResponse): Promise<void> => {
    try {
      const payload: unknown = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
      assertJsonValue(payload);
      const result = await dispatchBackendCallback(payload);
      if (result.ok && result.value !== undefined)
        assertJsonValue(result.value);
      response.status(result.ok ? 200 : 500).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      response.status(500).json({ ok: false, error: { message } });
    }
  };
}

/** Create a browser callback invoker for a backend HTTP callback endpoint.
 * @internal
 */
export function createHttpBackendCallbackInvoker(options: HttpBackendCallbackInvokerOptions): BackendCallbackInvoker {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (fetcher === undefined)
    throw new Error("The global fetch API is not available.");

  return async (name, ...args) => {
    const url = typeof options.url === "function" ? options.url() : options.url;
    const request: CallbackRequest = { name, args };
    assertJsonValue(request);

    let response: Response;
    try {
      response = await fetcher(url, {
        method: "POST",
        // Keep callback requests simple so test servers do not need a CORS preflight.
        body: JSON.stringify(request),
      });
    } catch (error) {
      throw new Error(`Failed to invoke backend callback at ${url}.`, { cause: error });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error(`Backend callback at ${url} returned invalid JSON.`, { cause: error });
    }

    return unwrapCallbackResponse(payload, "the HTTP backend callback endpoint");
  };
}
