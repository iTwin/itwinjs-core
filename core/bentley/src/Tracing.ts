/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

import type { ContextAPI, SpanAttributes, SpanAttributeValue, SpanContext, SpanOptions, TraceAPI, Tracer } from "@opentelemetry/api";
import { LogFunction, Logger } from "./Logger";

// re-export so that consumers can construct full SpanOptions object without external dependencies
/**
 * Mirrors the SpanKind enum from [@opentelemetry/api](https://open-telemetry.github.io/opentelemetry-js/enums/_opentelemetry_api.SpanKind.html)
 * @public
 */
export enum SpanKind {
  INTERNAL = 0,
  SERVER = 1,
  CLIENT = 2,
  PRODUCER = 3,
  CONSUMER = 4
}

function isValidPrimitive(val: unknown): val is SpanAttributeValue {
  return typeof val === "string" || typeof val === "number" || typeof val === "boolean";
}

// Only _homogenous_ arrays of strings, numbers, or booleans are supported as OpenTelemetry Attribute values.
// Per the spec (https://opentelemetry.io/docs/reference/specification/common/common/#attribute), empty arrays and null values are supported too.
function isValidPrimitiveArray(val: unknown): val is SpanAttributeValue {
  if (!Array.isArray(val))
    return false;

  let itemType;
  for (const x of val) {
    if (x === undefined || x === null)
      continue;

    if (!itemType) {
      itemType = typeof x;
      if (!isValidPrimitive(x))
        return false;
    }

    if (typeof x !== itemType)
      return false;
  }
  return true;
}

function isPlainObject(obj: unknown): obj is object {
  return typeof obj === "object" && obj !== null && Object.getPrototypeOf(obj) === Object.prototype;
}

function* getFlatEntries(obj: unknown, path = ""): Iterable<[string, SpanAttributeValue]> {
  if (isValidPrimitiveArray(obj)) {
    yield [path, obj];
    return;
  }

  // Prefer JSON serialization over flattening for any non-POJO types.
  // There's just too many ways trying to flatten those can go wrong (Dates, Buffers, TypedArrays, etc.)
  if (!isPlainObject(obj) && !Array.isArray(obj)) {
    yield [path, isValidPrimitive(obj) ? obj : JSON.stringify(obj)];
    return;
  }

  // Always serialize empty objects/arrays as empty array values
  const entries = Object.entries(obj);
  if (entries.length === 0)
    yield [path, []];

  for (const [key, val] of entries)
    yield* getFlatEntries(val, (path === "") ? key : `${path}.${key}`);
}

function flattenObject(obj: object): SpanAttributes {
  return Object.fromEntries(getFlatEntries(obj));
}

/**
 * Enables OpenTelemetry tracing in addition to traditional logging.
 * @public
 */
export class Tracing {
  private static _tracer?: Tracer;
  private static _openTelemetry?: { trace: Pick<TraceAPI, "setSpan" | "setSpanContext" | "getSpan">, context: Pick<ContextAPI, "active" | "with"> };

  /**
   * If OpenTelemetry tracing is enabled, creates a new span and runs the provided function in it.
   * If OpenTelemetry tracing is _not_ enabled, runs the provided function.
   * @param name name of the new span
   * @param fn function to run inside the new span
   * @param options span options
   * @param parentContext optional context used to retrieve parent span id
   */
  public static async withSpan<T>(name: string, fn: () => Promise<T>, options?: SpanOptions, parentContext?: SpanContext): Promise<T> {
    if (Tracing._tracer === undefined || Tracing._openTelemetry === undefined)
      return fn();

    // this case is for context propagation - parentContext is typically constructed from HTTP headers
    const parent = parentContext === undefined
      ? Tracing._openTelemetry.context.active()
      : Tracing._openTelemetry.trace.setSpanContext(Tracing._openTelemetry.context.active(), parentContext);

    return Tracing._openTelemetry.context.with(
      Tracing._openTelemetry.trace.setSpan(
        parent,
        Tracing._tracer.startSpan(name, options, Tracing._openTelemetry.context.active()),
      ),
      async () => {
        try {
          return await fn();
        } catch (err) {
          if (err instanceof Error) // ignore non-Error throws, such as RpcControlResponse
            Tracing._openTelemetry?.trace.getSpan(Tracing._openTelemetry.context.active())?.setAttribute("error", true);
          throw err;
        } finally {
          Tracing._openTelemetry?.trace.getSpan(Tracing._openTelemetry.context.active())?.end();
        }
      },
    );
  }

  /**
   * Enable logging to OpenTelemetry. [[Tracing.withSpan]] will be enabled, all log entries will be attached to active span as span events.
   * [IModelHost.startup]($backend) will call this automatically if the `enableOpenTelemetry` option is enabled and it succeeds in requiring `@opentelemetry/api`.
   * @note Node.js OpenTelemetry SDK should be initialized by the user.
   */
  public static enableOpenTelemetry(tracer: Tracer, api: typeof Tracing._openTelemetry) {
    Tracing._tracer = tracer;
    Tracing._openTelemetry = api;
    Logger.logTrace = Tracing.withOpenTelemetry(Logger.logTrace.bind(Logger)).bind(Logger);
    Logger.logInfo = Tracing.withOpenTelemetry(Logger.logInfo.bind(Logger)).bind(Logger);
    Logger.logWarning = Tracing.withOpenTelemetry(Logger.logWarning.bind(Logger)).bind(Logger);
    Logger.logError = Tracing.withOpenTelemetry(Logger.logError.bind(Logger)).bind(Logger);
  }

  private static withOpenTelemetry(base: LogFunction, isError: boolean = false): LogFunction {
    return (category, message, metaData) => {
      try {
        Tracing._openTelemetry?.trace.getSpan(Tracing._openTelemetry.context.active())?.addEvent(message, { ...flattenObject(Logger.getMetaData(metaData)), error: isError });
      } catch (_e) { } // avoid throwing random errors (with stack trace mangled by async hooks) when openTelemetry collector doesn't work
      base(category, message, metaData);
    };
  }

  /** Set attributes on currently active openTelemetry span. Doesn't do anything if openTelemetry logging is not initialized.
   * @param attributes The attributes to set
   */
  public static setAttributes(attributes: SpanAttributes) {
    Tracing._openTelemetry?.trace.getSpan(Tracing._openTelemetry.context.active())?.setAttributes(attributes);
  }
}
