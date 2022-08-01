/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import path from "path";
import { parse as parseVersion } from "semver";
import { Element, IModelDb } from "@itwin/core-backend";
import { DbResult, Id64String, SpanKind } from "@itwin/core-bentley";
import {
  Diagnostics, DiagnosticsLogEntry, DiagnosticsLogMessage, DiagnosticsOptions, DiagnosticsScopeLogs, HrTime,
  InstanceKey, ReadableSpan, Resource, TimedEvent,
} from "@itwin/presentation-common";
import { randomBytes } from "crypto";

/** @internal */
export function getElementKey(imodel: IModelDb, id: Id64String): InstanceKey | undefined {
  let key: InstanceKey | undefined;
  const query = `SELECT ECClassId FROM ${Element.classFullName} e WHERE ECInstanceId = ?`;
  imodel.withPreparedStatement(query, (stmt) => {
    try {
      stmt.bindId(1, id);
      if (stmt.step() === DbResult.BE_SQLITE_ROW)
        key = { className: stmt.getValue(0).getClassNameForClassId().replace(".", ":"), id };
    } catch { }
  });
  return key;
}

/** @internal */
export function normalizeVersion(version?: string) {
  if (version) {
    const parsedVersion = parseVersion(version, true);
    if (parsedVersion)
      return `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch}`;
  }
  return "0.0.0";
}

/** @internal */
// istanbul ignore next
export const getLocalesDirectory = (assetsDirectory: string) => path.join(assetsDirectory, "locales");

/** @alpha */
export type BackendDiagnosticsHandler = (logs: Diagnostics) => void;

/** @alpha */
export interface BackendDiagnosticsOptions extends DiagnosticsOptions {
  handler: BackendDiagnosticsHandler;
}

/** @public */
export interface BackendDiagnosticsAttribute {
  /** @alpha */
  diagnostics?: BackendDiagnosticsOptions;
}

/** @internal */
export function filterDiagnostics(diagnostics: Diagnostics, duration?: number): Diagnostics | undefined {
  const defaultMinDuration = 100;
  const minDuration = duration && duration > defaultMinDuration ? duration : defaultMinDuration;
  const filteredLogs: DiagnosticsScopeLogs[] = [];
  for (const logs of diagnostics.logs ?? []) {
    const filteredScopeLogs = filterScopeLogs(logs, minDuration);
    if (filteredScopeLogs)
      filteredLogs.push(filteredScopeLogs);
  }

  if (filteredLogs.length === 0)
    return undefined;

  return { logs: filteredLogs };
}

/** @internal */
function filterScopeLogs(logs: DiagnosticsScopeLogs, duration: number): DiagnosticsScopeLogs | undefined {
  const filteredNestedLogs: DiagnosticsLogEntry[] = [];
  for (const entry of logs.logs ?? []) {
    if (isLogMessage(entry))
      filteredNestedLogs.push(entry);
    else {
      const filteredScopeLogs = filterScopeLogs(entry, duration);
      if (filteredScopeLogs)
        filteredNestedLogs.push(filteredScopeLogs);
    }
  }

  const isValidTime = logs.duration && logs.duration >= duration;
  if (filteredNestedLogs.length === 0 && !isValidTime)
    return undefined;

  return { ...logs, ...(filteredNestedLogs.length > 0 ? { logs: filteredNestedLogs } : undefined ) };
}

/** @internal */
export function convertToReadableSpans(diagnostics: Diagnostics): ReadableSpan[] {
  let spans: ReadableSpan[] = [];
  for (const logs of diagnostics.logs ?? []) {
    const nestedSpans = convertScopeToReadableSpans(logs, generateTraceId());
    spans = spans.concat(nestedSpans);
  }
  return spans;
}

/** @internal */
function convertScopeToReadableSpans(logs: DiagnosticsScopeLogs, traceId: string, parentSpanId?: string): ReadableSpan[] {
  if (!logs.scopeCreateTimestamp || !logs.duration)
    return [];

  const spanId = generateSpanId();
  let spans: ReadableSpan[] = [];
  const events: TimedEvent[] = [];

  for (const entry of logs.logs ?? []) {
    if (isScopeLogs(entry))
      spans = spans.concat(convertScopeToReadableSpans(entry, traceId, spanId));
    else if (isLogMessage(entry)) {
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
    }
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
    status: { code: 0 },
    attributes: {},
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

/** @internal */
function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}

/** @internal */
function generateTraceId(): string {
  return randomBytes(16).toString("hex");
}

/** @internal */
function isScopeLogs(logEntry: DiagnosticsLogEntry): logEntry is DiagnosticsScopeLogs {
  return (logEntry as DiagnosticsScopeLogs).scope !== undefined;
}

/** @internal */
function isLogMessage(logEntry: DiagnosticsLogEntry): logEntry is DiagnosticsLogMessage {
  return (logEntry as DiagnosticsLogMessage).message !== undefined;
}

/** @internal */
function millisToHrTime(millis: number): HrTime {
  const hrTime: HrTime = [0, 0];
  hrTime[0] = Math.trunc(millis / 1000);
  hrTime[1] = (millis - hrTime[0] * 1000) * 1e6;
  return hrTime;
}
