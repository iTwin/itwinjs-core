/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */
import { Diagnostics, DiagnosticsLogEntry, DiagnosticsScopeLogs } from "@itwin/presentation-common";
import { randomBytes } from "crypto";

/**
 * Mirrors the ReadableSpan interface from [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js).
 * ReadableSpan[] can be passed to OpenTelemetry exporters.
 * @public
 */
export interface ReadableSpan {
  name: string;
  kind: SpanKind;
  spanContext: () => SpanContext;
  parentSpanId?: string;
  startTime: HrTime;
  endTime: HrTime;
  status: { code: SpanStatusCode };
  attributes: Attributes;
  links: [];
  events: TimedEvent[];
  duration: HrTime;
  ended: boolean;
  resource: Resource;
  instrumentationLibrary: { name: string };
}

/**
 * Mirrors the SpanKind enum from [@opentelemetry/api](https://open-telemetry.github.io/opentelemetry-js-api/enums/spankind)
 * @public
 */
export enum SpanKind {
  INTERNAL = 0,
  SERVER = 1,
  CLIENT = 2,
  PRODUCER = 3,
  CONSUMER = 4
}

/** @public */
export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

/** @public */
export type HrTime = [number, number];

/** @public */
export enum SpanStatusCode {
  UNSET = 0,
  OK = 1,
  ERROR = 2
}

/** @public */
export interface Attributes {
  [attributeKey: string]: string | string[];
}

/** @public */
export interface TimedEvent {
  time: HrTime;
  name: string;
  attributes: Attributes;
}

/** @public */
export class Resource {
  public attributes: Attributes;

  constructor(attributes: Attributes) {
    this.attributes = attributes;
  }

  public merge(other: Resource | null): Resource {
    return new Resource({ ...this.attributes, ...other?.attributes });
  }
}

/** @public */
export function convertToReadableSpans(diagnostics: Diagnostics, parentSpanContext?: SpanContext): ReadableSpan[] {
  let spans: ReadableSpan[] = [];
  for (const logs of diagnostics.logs ?? []) {
    const nestedSpans = convertScopeToReadableSpans(logs, parentSpanContext ? parentSpanContext.traceId : generateTraceId(), parentSpanContext?.spanId);
    spans = spans.concat(nestedSpans);
  }
  return spans;
}

function convertScopeToReadableSpans(logs: DiagnosticsScopeLogs, traceId: string, parentSpanId?: string): ReadableSpan[] {
  if (!logs.scopeCreateTimestamp || !logs.duration)
    return [];

  const spanId = generateSpanId();
  let spans: ReadableSpan[] = [];
  const events: TimedEvent[] = [];

  for (const entry of logs.logs ?? []) {
    if (DiagnosticsLogEntry.isMessage(entry)) {
      const event: TimedEvent = {
        time: millisToHrTime(entry.timestamp),
        name: entry.message,
        attributes: {
          category: entry.category,
          ...(entry.severity.dev ? { devSeverity: entry.severity.dev } : undefined),
          ...(entry.severity.editor ? { editorSeverity: entry.severity.editor } : undefined),
        },
      };
      events.push(event);
    } else
      spans = spans.concat(convertScopeToReadableSpans(entry, traceId, spanId));
  }

  const span: ReadableSpan = {
    name: logs.scope,
    kind: SpanKind.INTERNAL,
    spanContext: () => {
      return { traceId, spanId, traceFlags: 0 };
    },
    ...(parentSpanId ? { parentSpanId } : undefined),
    startTime: millisToHrTime(logs.scopeCreateTimestamp),
    endTime: millisToHrTime(logs.scopeCreateTimestamp + logs.duration),
    status: { code: SpanStatusCode.UNSET },
    attributes: { ...logs.attributes ? logs.attributes : undefined },
    links: [],
    events,
    duration: millisToHrTime(logs.duration),
    ended: true,
    resource: new Resource({ "service.name": "iTwin.js Presentation" }),
    instrumentationLibrary: { name: "" },
  };
  spans.push(span);

  return spans;
}

/**
 * A valid span identifier is an 8-byte array with at least one non-zero byte
 */
function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * A valid trace identifier is a 16-byte array with at least one non-zero byte
 */
function generateTraceId(): string {
  return randomBytes(16).toString("hex");
}

function millisToHrTime(millis: number): HrTime {
  const hrTime: HrTime = [0, 0];
  hrTime[0] = Math.trunc(millis / 1000);
  hrTime[1] = (millis - hrTime[0] * 1000) * 1e6;
  return hrTime;
}
