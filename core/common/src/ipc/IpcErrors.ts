/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { BentleyError, JsonUtils, LoggingMetaData } from "@itwin/core-bentley";
import { IpcInvokeReturn } from "./IpcSocket";

/**
 * Serialize a value thrown by an Ipc handler into the [[IpcInvokeReturn]] `error` envelope so it can be
 * transmitted across an Ipc socket via the [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).
 *
 * The serializer is hardened against values that cannot be structured-cloned: it copies the (non-enumerable)
 * `message`/`stack`/`cause` members of `Error`, preserves `BentleyError` identity (`iTwinErrorId` and optional
 * logging metadata), recurses into nested `Error` instances and plain objects, strips functions and class
 * instances, and guards against cycles.
 *
 * Used by both the backend and frontend `IpcHandler` implementations so the two directions behave identically.
 * @param err The thrown value to serialize.
 * @param includeStack Whether to include `Error.stack` in the serialized output.
 * @returns An [[IpcInvokeReturn]] holding the serialized `error`.
 * @internal
 */
export function serializeIpcError(err: unknown, includeStack: boolean): IpcInvokeReturn {
  if (!JsonUtils.isObject(err)) // if the exception isn't an object, just forward it
    return { error: err };

  const serialize = (e: any, visited = new WeakSet<object>()): any => {
    if (visited.has(e))
      return undefined;
    visited.add(e);
    try {
      const serialized: any = { ...e };

      for (const sym of Object.getOwnPropertySymbols(serialized))
        delete serialized[sym]; // symbol-keyed properties cannot be structured-cloned

      if (e instanceof Error) {
        serialized.message = e.message; // NB: .message and .stack are non-enumerable on Error instances
        if (includeStack)
          serialized.stack = e.stack;

        // Error.cause is typically non-enumerable and must be copied explicitly.
        if (Object.prototype.hasOwnProperty.call(e, "cause"))
          serialized.cause = (e as { cause?: unknown }).cause;
      }

      if (e instanceof BentleyError) {
        serialized.iTwinErrorId = e.iTwinErrorId;
        if (e.hasMetaData)
          serialized.loggingMetadata = e.loggingMetadata;
        delete serialized._metaData;
      }

      // Only recurse into Error instances and plain objects — not class instances like Date or Buffer.
      const shouldRecurse = (val: any) => val instanceof Error || (JsonUtils.isObject(val) && Object.getPrototypeOf(val) === Object.prototype);
      const isSerializableLeaf = (val: unknown): boolean => {
        const t = typeof val;
        return val === null || val === undefined || val instanceof Date
          || t === "string" || t === "number" || t === "boolean";
      };
      for (const key of Object.keys(serialized)) {
        const val = serialized[key];
        if (Array.isArray(val))
          serialized[key] = val.map((item) => shouldRecurse(item) ? serialize(item, visited) : isSerializableLeaf(item) ? item : undefined);
        else if (shouldRecurse(val))
          serialized[key] = serialize(val, visited);
        else if (!isSerializableLeaf(val))
          delete serialized[key]; // strip non-cloneable values (functions, class instances, etc.)
      }

      return serialized;
    } finally {
      // Remove from the stack so a sibling branch can still serialize this object.
      visited.delete(e);
    }
  };

  return { error: serialize(err) };
}

/**
 * Reconstruct an `Error` from the serialized `error` produced by [[serializeIpcError]], so the Ipc caller can
 * `throw` it. If the serialized error carries `BentleyError` identity it is rebuilt via `typedErrorClass`
 * (preserving `errorNumber`, `name`/`iTwinErrorId`, message, and logging metadata); otherwise a plain `Error` is
 * produced. Remaining own-enumerable properties are copied onto the result.
 *
 * Both Ipc directions share this helper, passing the typed-error class appropriate for the caller: the backend
 * rebuilds a [FrontendError]($common) for errors thrown by a frontend handler, while the frontend rebuilds a
 * [BackendError]($common) for the reverse (frontend-to-backend) direction.
 * @param err The serialized error object (must be an object; callers should forward non-object values as-is).
 * @param typedErrorClass Constructor for the typed error to build when `err` carries `BentleyError` identity
 * (e.g. [FrontendError]($common) on the backend, [BackendError]($common) on the frontend).
 * @returns The reconstructed `Error` to throw.
 * @internal
 */
export function rebuildIpcError(
  err: any,
  typedErrorClass: new (errorNumber: number, name: string, message: string, getMetaData?: LoggingMetaData) => Error,
): Error {
  // if the exception was a BentleyError, rebuild it as the caller's typed error; otherwise produce a plain Error.
  if (!BentleyError.isError(err))
    return Object.assign(new Error(typeof err.message === "string" ? err.message : "unknown error"), err);

  const trimErr: any = { ...err };
  delete trimErr.iTwinErrorId;    // getter on the typed error; assigning would throw
  delete trimErr.loggingMetadata; // getter on the typed error; assigning would throw
  // restores original `name` (and thus iTwinErrorId.key) plus any custom fields
  return Object.assign(new typedErrorClass(err.errorNumber, err.iTwinErrorId.key, err.message, err.loggingMetadata), trimErr);
}
