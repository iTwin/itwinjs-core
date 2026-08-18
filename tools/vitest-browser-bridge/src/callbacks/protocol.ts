/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** The IPC channel used by the Electron callback transport.
 * @internal
 */
export const CALLBACK_CHANNEL = "vitest-browser-bridge:callback" as const;

/** The context-isolated global exposed by the Electron bridge preload.
 * @internal
 */
export const CALLBACK_BRIDGE_GLOBAL = "__vitestCallbackBridge" as const;

/** A named callback request sent over the privileged Electron transport.
 * @internal
 */
export interface CallbackRequest {
  readonly name: string;
  readonly args: readonly unknown[];
}

export type CallbackResponse =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: { readonly message: string; readonly stack?: string } };

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

/** Validate a transport payload at the Electron main-process boundary.
 * @internal
 */
export function parseCallbackRequest(payload: unknown): CallbackRequest {
  if (!isRecord(payload))
    throw new Error("Invalid callback payload.");

  assertCallbackName(payload.name);
  if (!Array.isArray(payload.args))
    throw new Error("Callback arguments must be an array.");

  return {
    name: payload.name,
    args: payload.args,
  };
}

/** Convert a backend result into an explicit response so expected callback failures do not become
 * noisy unhandled Electron IPC errors.
 * @internal
 */
export async function captureCallbackResponse(callback: () => Promise<unknown>): Promise<CallbackResponse> {
  try {
    return { ok: true, value: await callback() };
  } catch (reason) {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    return {
      ok: false,
      error: {
        message: error.message,
        ...(error.stack === undefined ? {} : { stack: error.stack }),
      },
    };
  }
}

/** Unwrap a callback response in the renderer.
 * @internal
 */
export function unwrapCallbackResponse(response: CallbackResponse): unknown {
  if (response.ok)
    return response.value;

  const error = new Error(response.error.message);
  if (response.error.stack !== undefined)
    error.stack = response.error.stack;
  throw error;
}
