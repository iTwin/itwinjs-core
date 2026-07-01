/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { IModelStatus, JsonUtils, LoggingMetaData, PickAsyncMethods } from "@itwin/core-bentley";
import { IModelError } from "../IModelError";
import { rebuildIpcError, serializeIpcError } from "./IpcErrors";
import { IpcInvokeReturn } from "./IpcSocket";

/**
 * Unwrap an [[IpcInvokeReturn]] produced by an Ipc handler: return its `result` on success, or rethrow the
 * serialized `error` on failure. If the error carries `BentleyError` identity it is rebuilt via [[rebuildIpcError]];
 * otherwise the raw value is rethrown.
 *
 * Shared by both Ipc directions so the frontend (`IpcApp`, throwing [BackendError]($common)) and the backend
 * (`IpcHost`, throwing [FrontendError]($common)) unwrap invocation results identically.
 * @param retVal The [[IpcInvokeReturn]] returned by the remote handler.
 * @param typedErrorClass Constructor for the typed error to build when the serialized error carries `BentleyError`
 * identity (e.g. [BackendError]($common) on the frontend, [FrontendError]($common) on the backend).
 * @returns The handler's `result` value, typed as `T` (defaults to `unknown`, so untyped callers must narrow).
 * @throws The reconstructed error when `retVal` carries an `error`.
 * @internal
 */
export function unwrapIpcInvokeReturn<T = unknown>(
  retVal: IpcInvokeReturn,
  typedErrorClass: new (errorNumber: number, name: string, message: string, getMetaData?: LoggingMetaData) => Error,
): T {
  if (retVal.error === undefined)
    return retVal.result as T; // method was successful

  // remote handler threw an exception, rethrow one on this side
  const err = retVal.error;
  if (!JsonUtils.isObject(err)) // exception wasn't an object?
    throw retVal.error; // eslint-disable-line @typescript-eslint/only-throw-error

  throw rebuildIpcError(err, typedErrorClass);
}

/**
 * Create a type-safe `Proxy` that routes every method access to `call`, forwarding the accessed method name and
 * its arguments. Shared by the frontend (`IpcApp.makeIpcProxy`) and backend (`IpcHost.makeIpcProxy`) so both build
 * their remote-interface proxies identically; each supplies a `call` bound to its own `callIpcChannel`.
 * @param call Invoked with the accessed method name followed by the call arguments.
 * @returns A `Proxy` exposing `K`'s async methods.
 * @internal
 */
export function createIpcProxy<K>(call: (methodName: string, ...args: any[]) => Promise<any>): PickAsyncMethods<K> {
  return new Proxy({} as PickAsyncMethods<K>, {
    get(_target, methodName: string) {
      return async (...args: any[]) => call(methodName, ...args);
    },
  });
}

/**
 * Create the handler that an `IpcHandler` registers on its channel: it looks up `funcName` on `impl`, invokes it
 * with `args`, and packages the outcome as an [[IpcInvokeReturn]] (`{ result }` on success, or a serialized `error`
 * via [[serializeIpcError]] on failure). Shared by the frontend and backend `IpcHandler.register` implementations
 * so method dispatch and error packaging behave identically in both directions.
 * @param impl The handler instance whose methods are exposed over the channel.
 * @param channelName The channel `impl` is registered on, used for diagnostic messages.
 * @param includeStack Whether to include `Error.stack` in serialized errors, or a function evaluated per
 * invocation to decide (the backend omits stacks when [[IpcHost.noStack]] is set, which can change at runtime).
 * @returns An async dispatcher `(funcName, ...args) => Promise<IpcInvokeReturn>`.
 * @internal
 */
export function createIpcDispatcher(
  impl: object,
  channelName: string,
  includeStack: boolean | (() => boolean),
): (funcName: string, ...args: any[]) => Promise<IpcInvokeReturn> {
  const prohibitedFunctions = Object.getOwnPropertyNames(Object.getPrototypeOf({}));

  return async (funcName: string, ...args: any[]): Promise<IpcInvokeReturn> => {
    try {
      if (prohibitedFunctions.includes(funcName))
        throw new Error(`Method "${funcName}" not available for channel: ${channelName}`);

      const func = (impl as any)[funcName];
      if (typeof func !== "function")
        throw new IModelError(IModelStatus.FunctionNotFound, `Method "${impl.constructor.name}.${funcName}" not found on IpcHandler registered for channel: ${channelName}`);

      return { result: await func.call(impl, ...args) };
    } catch (err: unknown) {
      return serializeIpcError(err, typeof includeStack === "function" ? includeStack() : includeStack);
    }
  };
}
