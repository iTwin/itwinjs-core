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
import { Diagnostics, DiagnosticsLogEntry, DiagnosticsLogMessage, DiagnosticsOptions, DiagnosticsScopeLogs, InstanceKey } from "@itwin/presentation-common";
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

/** @public */
export type DiagnosticsCallback = (spans: ReadableSpan[]) => void;

/**
 * Mirrors the ReadableSpan interface from [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js)
 * @public
 */
export interface ReadableSpan {
  name: string;
  kind: SpanKind;
  spanContext: () => { traceId: string, spanId: string, traceFlags: number };
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

/** @public */
export type HrTime = [number, number];

/** @public */
export enum SpanStatusCode {
  UNSET = 0,
  OK = 1,
  ERROR = 2
}

/** @public */
export interface Attributes  {
  [attributeKey: string]: string | string[];
}

/** @public */
export interface TimedEvent {
  time: HrTime;
  name: string;
  attributes: { [attributeKey: string]: string };
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
    if (isLogMessage(entry)) {
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

/**
 * A valid span identifier is an 8-byte array with at least one non-zero byte
 * @internal
 */
function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * A valid trace identifier is a 16-byte array with at least one non-zero byte
 * @internal
 */
function generateTraceId(): string {
  return randomBytes(16).toString("hex");
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
