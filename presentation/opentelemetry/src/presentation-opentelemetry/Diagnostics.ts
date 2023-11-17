/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */
import { Diagnostics, DiagnosticsLogEntry, DiagnosticsScopeLogs } from "@itwin/presentation-common";
import { randomBytes } from "crypto";
import { HrTime, SpanContext, SpanKind, SpanStatusCode, TraceFlags } from "@opentelemetry/api";
import { ReadableSpan, TimedEvent } from "@opentelemetry/sdk-trace-base";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

/**
 * Convert diagnostics to readable span format that can be passed to OpenTelemetry exporter.
 * @beta
 */
export function convertToReadableSpans(diagnostics: Diagnostics, parentSpanContext?: SpanContext): ReadableSpan[] {
  const spans: ReadableSpan[] = [];
  for (const logs of diagnostics.logs ?? []) {
    const nestedSpans = convertScopeToReadableSpans(logs, parentSpanContext ? parentSpanContext.traceId : generateTraceId(), parentSpanContext?.spanId);
    spans.push(...nestedSpans);
  }
  return spans;
}

function convertScopeToReadableSpans(logs: DiagnosticsScopeLogs, traceId: string, parentSpanId?: string): ReadableSpan[] {
  if (!logs.scopeCreateTimestamp || !logs.duration)
    return [];

  const spanId = generateSpanId();
  const spans: ReadableSpan[] = [];
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
    } else {
      spans.push(...convertScopeToReadableSpans(entry, traceId, spanId));
    }
  }

  const span: ReadableSpan = {
    name: logs.scope,
    kind: SpanKind.INTERNAL,
    spanContext: () => {
      return { traceId, spanId, traceFlags: TraceFlags.NONE };
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
    resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: "iTwin.js Presentation" }),
    instrumentationLibrary: { name: "" },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
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
