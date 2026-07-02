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
      // Recursively sanitize a value for structured-clone: arrays (including nested arrays) are walked
      // element-by-element, Errors/plain objects are recursed into, primitives/Dates pass through unchanged,
      // and anything else non-cloneable (functions, RegExp, Map, Set, typed arrays, other class instances, etc.)
      // is stripped to `undefined`.
      const serializeValue = (val: any): any => {
        if (Array.isArray(val))
          return val.map((item) => serializeValue(item));
        if (shouldRecurse(val))
          return serialize(val, visited);
        return isSerializableLeaf(val) ? val : undefined;
      };
      // `loggingMetadata` was deliberately captured above from `BentleyError.loggingMetadata` (which may be an
      // arbitrary object shape returned by a `GetMetaDataFunction`, not necessarily a plain-object literal) — skip
      // it here so the generic sanitization pass above doesn't silently strip it for not matching the plain-object
      // heuristic.
      const genericStripExcludedKeys = new Set(["loggingMetadata"]);
      for (const key of Object.keys(serialized)) {
        if (genericStripExcludedKeys.has(key))
          continue;
        serialized[key] = serializeValue(serialized[key]);
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
 * `throw` it.
 *
 * By default (no `typedErrorClass`) a plain `Error` is produced with the serialized `message`, `iTwinErrorId`,
 * `errorNumber`, logging metadata, and any custom properties copied onto it. This follows the `ITwinError`
 * paradigm: callers identify the error with [ITwinError.isError]($bentley) (or [BentleyError.isError]($bentley) for
 * legacy error numbers) rather than `instanceof`, which cannot survive marshalling across the Ipc boundary.
 *
 * For backwards compatibility, a caller may pass `typedErrorClass`; when the serialized error carries
 * `BentleyError` identity it is rebuilt as that class (preserving `errorNumber`, `name`/`iTwinErrorId`, message, and
 * logging metadata). The frontend uses this to keep rethrowing the pre-existing `@public` [BackendError]($common)
 * for the backend-to-frontend direction, so existing `instanceof BackendError` consumers keep working.
 * @param err The serialized error object (must be an object; callers should forward non-object values as-is).
 * @param typedErrorClass Optional constructor for the typed error to build when `err` carries `BentleyError`
 * identity (e.g. [BackendError]($common) on the frontend). Omit it to rebuild a plain `Error` (ITwinError paradigm).
 * @returns The reconstructed `Error` to throw.
 * @internal
 */
export function rebuildIpcError(
  err: any,
  typedErrorClass?: new (errorNumber: number, name: string, message: string, getMetaData?: LoggingMetaData) => Error,
): Error {
  // Default (ITwinError paradigm) or a non-BentleyError value: rebuild a plain Error, preserving iTwinErrorId,
  // errorNumber, message, and any custom fields so callers can identify it via ITwinError.isError / BentleyError.isError.
  if (typedErrorClass === undefined || !BentleyError.isError(err)) {
    const rebuilt = Object.assign(new Error(), err);
    // Object.assign above re-copies `err`'s own `message` (even a non-string one, e.g. `throw { message: 123 }`),
    // so guard/normalize the final message *after* the assign rather than before, or this would be silently overwritten.
    rebuilt.message = typeof err.message === "string" ? err.message : "unknown error";
    return rebuilt;
  }

  // Backwards compatibility: rebuild the caller's typed BentleyError subclass (e.g. BackendError).
  const trimErr: any = { ...err };
  delete trimErr.iTwinErrorId;    // getter on the typed error; assigning would throw
  delete trimErr.loggingMetadata; // getter on the typed error; assigning would throw
  // restores original `name` (and thus iTwinErrorId.key) plus any custom fields
  return Object.assign(new typedErrorClass(err.errorNumber, err.iTwinErrorId.key, err.message, err.loggingMetadata), trimErr);
}
