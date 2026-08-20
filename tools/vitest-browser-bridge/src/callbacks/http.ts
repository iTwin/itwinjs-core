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

/** Create a framework-neutral handler for an HTTP backend callback endpoint.
 * @internal
 */
export function createHttpBackendCallbackHandler() {
  return async (request: HttpBackendCallbackRequest, response: HttpBackendCallbackResponse): Promise<void> => {
    let payload: unknown;
    try {
      const body = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
      payload = JSON.parse(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      response.status(500).json({ ok: false, error: { message } });
      return;
    }

    const result = await dispatchBackendCallback(payload);
    response.status(result.ok ? 200 : 500).json(result);
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
