/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** The only method accepted by the test-only callback transport.
 * @internal
 */
export const CALLBACK_METHOD = "vitest.invokeCallback" as const;

/** The IPC channel used by the Electron callback transport.
 * @internal
 */
export const CALLBACK_CHANNEL = "vitest-browser-bridge:callback" as const;

/** The context-isolated global exposed by the generated Electron preload.
 * @internal
 */
export const CALLBACK_BRIDGE_GLOBAL = "__vitestCallbackBridge" as const;

/** A callback invocation before the per-session token is added by the Electron preload.
 * @internal
 */
export interface CallbackInvocation {
  readonly method: typeof CALLBACK_METHOD;
  readonly name: string;
  readonly args: readonly unknown[];
}

/** A callback invocation sent over the privileged Electron transport.
 * @internal
 */
export interface CallbackRequest extends CallbackInvocation {
  readonly token: string;
}

/** A successful callback response.
 * @internal
 */
export interface CallbackSuccessResponse {
  readonly ok: true;
  readonly value: unknown;
}

/** A serialized callback error.
 * @internal
 */
export interface SerializedCallbackError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
}

/** A failed callback response.
 * @internal
 */
export interface CallbackFailureResponse {
  readonly ok: false;
  readonly error: SerializedCallbackError;
}

/** The response returned by the backend callback transport.
 * @internal
 */
export type CallbackResponse = CallbackSuccessResponse | CallbackFailureResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Validate a callback name without binding the protocol to an application RPC surface.
 * @internal
 */
export function assertCallbackName(name: unknown): asserts name is string {
  if (typeof name !== "string" || name.trim().length === 0)
    throw new Error("Callback name must be a non-empty string.");
}

/** Validate a callback argument payload.
 * @internal
 */
export function assertCallbackArguments(args: unknown): asserts args is readonly unknown[] {
  if (!Array.isArray(args))
    throw new Error("Callback arguments must be an array.");
}

/** Create a browser-side callback invocation after validating its method, name, and payload.
 * @internal
 */
export function createCallbackInvocation(name: string, args: readonly unknown[]): CallbackInvocation {
  assertCallbackName(name);
  assertCallbackArguments(args);
  return {
    method: CALLBACK_METHOD,
    name,
    args: [...args],
  };
}

/** Create the token-bearing request used by the Electron main process.
 * @internal
 */
export function createCallbackRequest(token: string, invocation: CallbackInvocation): CallbackRequest {
  if (typeof token !== "string" || token.length === 0)
    throw new Error("Callback token must be a non-empty string.");
  return {
    ...invocation,
    token,
  };
}

/** Validate a transport payload and its per-run token in one place.
 * @internal
 */
export function parseCallbackRequest(payload: unknown, expectedToken: string): CallbackRequest {
  if (typeof expectedToken !== "string" || expectedToken.length === 0)
    throw new Error("Expected callback token must be a non-empty string.");
  if (!isRecord(payload))
    throw new Error("Invalid callback payload.");
  if (payload.method !== CALLBACK_METHOD)
    throw new Error(`Invalid callback method: ${String(payload.method)}.`);
  if (payload.token !== expectedToken)
    throw new Error("Invalid callback token.");

  assertCallbackName(payload.name);
  assertCallbackArguments(payload.args);
  return {
    method: CALLBACK_METHOD,
    token: expectedToken,
    name: payload.name,
    args: [...payload.args],
  };
}

/** Convert an arbitrary thrown value into a structured-clone-safe error.
 * @internal
 */
export function serializeCallbackError(reason: unknown): SerializedCallbackError {
  if (reason instanceof Error) {
    return {
      name: reason.name,
      message: reason.message,
      ...(reason.stack === undefined ? {} : { stack: reason.stack }),
    };
  }

  return {
    name: "Error",
    message: String(reason),
  };
}

/** Create a successful transport response.
 * @internal
 */
export function callbackSucceeded(value: unknown): CallbackSuccessResponse {
  return { ok: true, value };
}

/** Create a failed transport response.
 * @internal
 */
export function callbackFailed(reason: unknown): CallbackFailureResponse {
  return { ok: false, error: serializeCallbackError(reason) };
}

/** Validate and unwrap a response received by browser-side test code.
 * @internal
 */
export function unwrapCallbackResponse(response: unknown): unknown {
  if (!isRecord(response) || typeof response.ok !== "boolean")
    throw new Error("Invalid callback response.");
  if (response.ok) {
    return response.value;
  }

  const error = isRecord(response.error) ? response.error : undefined;
  const thrown = new Error(typeof error?.message === "string" ? error.message : "Backend callback failed.");
  if (typeof error?.name === "string")
    thrown.name = error.name;
  if (typeof error?.stack === "string")
    thrown.stack = error.stack;
  throw thrown;
}
