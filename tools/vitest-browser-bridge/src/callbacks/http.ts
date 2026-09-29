/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { dispatchBackendCallback } from "./backend.js";
import { type CallbackRequest, unwrapCallbackResponse } from "./protocol.js";

/** Environment variable that carries the per-run callback token to a test backend process.
 * @internal
 */
export const backendCallbackTokenEnvVar = "VITEST_BACKEND_CALLBACK_TOKEN";

/** Vitest `provide`/`inject` key that carries the per-run callback token to the browser.
 * Consumers declare it on Vitest's `ProvidedContext` as `backendCallbackToken: string`.
 * @internal
 */
export const backendCallbackTokenKey = "backendCallbackToken";

const minimumTokenLength = 32;

/** Create a per-run secret that authorizes browser calls to a test backend's callback endpoint.
 * @internal
 */
export function createBackendCallbackToken(): string {
  return globalThis.crypto.randomUUID();
}

function assertToken(token: unknown, source: string): asserts token is string {
  if (typeof token !== "string" || token.length < minimumTokenLength)
    throw new Error(`${source} must provide a backend callback token of at least ${minimumTokenLength} characters.`);
}

/** Read the per-run callback token passed to a test backend, failing if it is missing.
 * @internal
 */
export function readBackendCallbackToken(env: Readonly<Record<string, string | undefined>>): string {
  const token = env[backendCallbackTokenEnvVar];
  assertToken(token, backendCallbackTokenEnvVar);
  return token;
}

// Compare every character so the time taken does not reveal how much of a guess was right.
function tokensMatch(candidate: unknown, expected: string): boolean {
  if (typeof candidate !== "string" || candidate.length !== expected.length)
    return false;
  let difference = 0;
  for (let i = 0; i < expected.length; ++i)
    difference |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export interface HttpBackendCallbackInvokerOptions {
  readonly url: string | (() => string);
  /** The per-run callback token, usually `inject(backendCallbackTokenKey)`. */
  readonly token: string | (() => string);
  readonly fetch?: typeof globalThis.fetch;
}

export type BackendCallbackInvoker = (name: string, ...args: readonly unknown[]) => Promise<unknown>;

/** The request shape needed by an HTTP callback endpoint handler.
 * @internal
 */
export interface HttpBackendCallbackRequest {
  readonly body: unknown;
  readonly socket: { readonly remoteAddress?: string };
}

/** Options for an HTTP backend callback endpoint handler.
 * @internal
 */
export interface HttpBackendCallbackHandlerOptions {
  /** The per-run callback token, usually `readBackendCallbackToken(process.env)`. */
  readonly token: string;
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

// JSON drops `value: undefined`, so the HTTP transport marks a successful undefined result explicitly.
const undefinedHttpResult = { ok: true, undefined: true } as const;

function decodeHttpCallbackResponse(payload: unknown): unknown {
  if (typeof payload === "object" && payload !== null && !("value" in payload)
    && (payload as Record<string, unknown>).ok === true && (payload as Record<string, unknown>).undefined === true)
    return { ok: true, value: undefined };
  return payload;
}

function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined)
    return false;
  const ipv4 = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
  return address === "::1" || ipv4.startsWith("127.");
}

/** The body of an HTTP callback request. The token travels in the body, not a header, so the request
 * stays a CORS "simple" request that needs no preflight.
 */
interface HttpCallbackRequestBody extends CallbackRequest {
  readonly token: string;
}

/** Create a framework-neutral handler for an HTTP backend callback endpoint.
 * Test callbacks can change backend state and return secrets, so only a caller on this machine that
 * knows the per-run token may invoke them.
 * @internal
 */
export function createHttpBackendCallbackHandler(options: HttpBackendCallbackHandlerOptions) {
  assertToken(options.token, "An HTTP backend callback endpoint");
  const token = options.token;
  return async (request: HttpBackendCallbackRequest, response: HttpBackendCallbackResponse): Promise<void> => {
    const reject = (message: string) => response.status(403).json({ ok: false, error: { message: `Backend callback rejected: ${message}` } });
    const address = request.socket.remoteAddress;
    if (!isLoopbackAddress(address)) {
      reject(`caller address "${address ?? "unknown"}" is not a loopback address.`);
      return;
    }
    try {
      const payload: unknown = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
      if (typeof payload !== "object" || payload === null || !tokensMatch((payload as Partial<HttpCallbackRequestBody>).token, token)) {
        reject("missing or invalid callback token.");
        return;
      }
      const { name, args } = payload as HttpCallbackRequestBody;
      const callbackRequest = { name, args };
      assertJsonValue(callbackRequest);
      const result = await dispatchBackendCallback(callbackRequest);
      if (result.ok && result.value === undefined) {
        response.status(200).json(undefinedHttpResult);
        return;
      }
      if (result.ok)
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
    const token = typeof options.token === "function" ? options.token() : options.token;
    assertToken(token, "The HTTP backend callback invoker");
    assertJsonValue({ name, args });
    const request: HttpCallbackRequestBody = { token, name, args };

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

    return unwrapCallbackResponse(decodeHttpCallbackResponse(payload), "HTTP backend callback endpoint");
  };
}
