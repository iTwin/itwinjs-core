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
 * transmitted across an Ipc socket via structured clone or JSON, depending on the transport.
 *
 * Hardens against values that can't be cloned: copies `Error`'s non-enumerable `message`/`stack`/`cause`,
 * preserves `BentleyError` identity (`iTwinErrorId` and logging metadata, normalized to a JSON-safe form),
 * recurses into nested `Error`s and plain objects, strips functions and class instances, and guards against cycles.
 * @param err The thrown value to serialize.
 * @param includeStack Whether to include `Error.stack` in the serialized output.
 * @returns An [[IpcInvokeReturn]] holding the serialized `error`.
 * @internal
 */
export function serializeIpcError(err: unknown, includeStack: boolean): IpcInvokeReturn {
  if (!JsonUtils.isObject(err))
    return { error: err };

  const serialize = (e: any, visited = new WeakSet<object>()): any => {
    if (visited.has(e))
      return undefined;
    visited.add(e);
    try {
      const serialized: any = { ...e };

      for (const sym of Object.getOwnPropertySymbols(serialized))
        delete serialized[sym]; // symbol-keyed properties cannot be structured-cloned

      // `iTwinErrorId`/`loggingMetadata` are prototype getters, so `Object.keys`/spread never pick them up; resolve
      // them explicitly. Shared by the top-level and metadata-nested paths below so they can't drift apart again.
      const applyBentleyErrorIdentity = (be: BentleyError, out: any, sanitize: (v: unknown) => unknown): void => {
        out.iTwinErrorId = be.iTwinErrorId;
        if (be.hasMetaData)
          out.loggingMetadata = sanitize(be.loggingMetadata);
        delete out._metaData;
      };

      if (e instanceof Error) {
        serialized.message = e.message; // NB: .message and .stack are non-enumerable on Error instances
        if (includeStack)
          serialized.stack = e.stack;

        // Error.cause is typically non-enumerable and must be copied explicitly.
        if (Object.prototype.hasOwnProperty.call(e, "cause"))
          serialized.cause = (e as { cause?: unknown }).cause;
      }

      if (e instanceof BentleyError)
        applyBentleyErrorIdentity(e, serialized, (v) => v); // loggingMetadata is sanitized once, below

      // Only recurse into Error instances and plain objects — not class instances like Date or Buffer.
      const shouldRecurse = (val: any) => val instanceof Error || (JsonUtils.isObject(val) && Object.getPrototypeOf(val) === Object.prototype);
      const isSerializableLeaf = (val: unknown): boolean => {
        const t = typeof val;
        return val === null || val === undefined || val instanceof Date
          || t === "string" || t === "number" || t === "boolean";
      };
      // Recurse into arrays, Errors, and plain objects; strip anything else non-cloneable (functions, RegExp,
      // Map, Set, typed arrays, other class instances) to `undefined`.
      const serializeValue = (val: any): any => {
        if (Array.isArray(val)) {
          // Arrays need their own cycle guard: they never pass through `serialize` below, so a self-referencing
          // array would otherwise recurse via `map` forever.
          if (visited.has(val))
            return undefined;
          visited.add(val);
          try {
            return val.map((item) => serializeValue(item));
          } finally {
            visited.delete(val);
          }
        }
        if (shouldRecurse(val))
          return serialize(val, visited);
        return isSerializableLeaf(val) ? val : undefined;
      };
      // `loggingMetadata` can be any shape (e.g. a `Map`/`Set` from a `GetMetaDataFunction`). Normalize it to a
      // JSON-safe form so it survives every transport — raw `Map`/`Set` clone fine over Electron's structured
      // clone but collapse to `{}` over the WebSocket transport, which uses `JSON.stringify`.
      const sanitizeMetadataValue = (val: any): any => {
        if (val === null || val === undefined || val instanceof Date || typeof val === "string" || typeof val === "number" || typeof val === "boolean")
          return val;
        if (typeof val !== "object" || visited.has(val))
          return undefined; // functions, symbols, or an already-visited (cyclic) value

        visited.add(val);
        try {
          if (val instanceof Map) {
            // String(k) can collide (e.g. two object keys); suffix with "#n" so entries aren't silently dropped.
            const out: any = {};
            const keyCounts = new Map<string, number>();
            for (const [k, v] of val) {
              const baseKey = String(k);
              const count = keyCounts.get(baseKey) ?? 0;
              keyCounts.set(baseKey, count + 1);
              out[count === 0 ? baseKey : `${baseKey}#${count}`] = sanitizeMetadataValue(v);
            }
            return out;
          }
          if (val instanceof Set)
            return [...val].map(sanitizeMetadataValue);
          if (Array.isArray(val))
            return val.map(sanitizeMetadataValue);
          if (val instanceof Error || (JsonUtils.isObject(val) && Object.getPrototypeOf(val) === Object.prototype)) {
            const out: any = {};
            for (const key of Object.keys(val))
              out[key] = sanitizeMetadataValue((val as any)[key]);
            if (val instanceof Error)
              out.message = val.message;
            if (val instanceof BentleyError)
              applyBentleyErrorIdentity(val, out, sanitizeMetadataValue);
            return out;
          }
          return undefined; // other class instances: not cloneable across every transport
        } finally {
          visited.delete(val);
        }
      };
      if (serialized.loggingMetadata !== undefined)
        serialized.loggingMetadata = sanitizeMetadataValue(serialized.loggingMetadata);

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
 * By default, rebuilds a plain `Error` following the `ITwinError` paradigm (identify via
 * [ITwinError.isError]($bentley), since `instanceof` cannot survive marshalling across the Ipc boundary). Pass
 * `typedErrorClass` for backwards compatibility to rebuild a legacy typed `BentleyError` subclass instead — the
 * frontend uses this to keep rethrowing [BackendError]($common).
 * @param err The serialized error object (must be an object; callers should forward non-object values as-is).
 * @param typedErrorClass Optional constructor for a legacy typed error (e.g. [BackendError]($common)). Omit for
 * the ITwinError paradigm.
 * @returns The reconstructed `Error` to throw.
 * @internal
 */
export function rebuildIpcError(
  err: any,
  typedErrorClass?: new (errorNumber: number, name: string, message: string, getMetaData?: LoggingMetaData) => Error,
): Error {
  if (typedErrorClass === undefined || !BentleyError.isError(err)) {
    const rebuilt = Object.assign(new Error(), err);
    // Object.assign above re-copies `err`'s own `message` (even a non-string one, e.g. `throw { message: 123 }`),
    // so guard/normalize the final message *after* the assign rather than before, or this would be silently overwritten.
    rebuilt.message = typeof err.message === "string" ? err.message : "unknown error";
    return rebuilt;
  }

  const trimErr: any = { ...err };
  delete trimErr.iTwinErrorId;    // getter on the typed error; assigning would throw
  delete trimErr.loggingMetadata; // getter on the typed error; assigning would throw
  return Object.assign(new typedErrorClass(err.errorNumber, err.iTwinErrorId.key, err.message, err.loggingMetadata), trimErr);
}
