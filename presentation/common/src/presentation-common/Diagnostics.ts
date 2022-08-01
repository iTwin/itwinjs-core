/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { SpanKind } from "@itwin/core-bentley";

/** @alpha */
export type DiagnosticsLoggerSeverity = "error" | "warning" | "info" | "debug" | "trace";

/** @alpha */
export interface Diagnostics {
  logs?: DiagnosticsScopeLogs[];
}

/** @alpha */
export interface ClientDiagnostics extends Diagnostics {
  backendVersion?: string;
}

/** @alpha */
export type DiagnosticsCallback = (spans: ReadableSpan[]) => void;

/** @alpha */
export interface DiagnosticsOptions {
  /**
   * Flag specifying that performance should be measured, or
   * minimum duration in milliseconds for which performance metric should be included.
   */
  perf?: boolean | { duration: number };
  /** Severity for developer log messages */
  dev?: boolean | DiagnosticsLoggerSeverity;
  /** Severity for presentation rules' editor log messages */
  editor?: boolean | DiagnosticsLoggerSeverity;
}

/** @alpha */
export type ClientDiagnosticsHandler = (logs: ClientDiagnostics) => void;

/** @alpha */
export interface ClientDiagnosticsOptions extends DiagnosticsOptions {
  backendVersion?: boolean;
  handler: ClientDiagnosticsHandler;
}

/** @public */
export interface ClientDiagnosticsAttribute {
  /** @alpha */
  diagnostics?: ClientDiagnosticsOptions;
}

/** @alpha */
export interface DiagnosticsLogMessage {
  severity: {
    dev?: DiagnosticsLoggerSeverity;
    editor?: DiagnosticsLoggerSeverity;
  };
  category: string;
  message: string;
  timestamp: number;
}

/** @alpha */
export interface DiagnosticsScopeLogs {
  scope: string;
  scopeCreateTimestamp?: number;
  duration?: number;
  logs?: DiagnosticsLogEntry[];
}

/** @alpha */
export type DiagnosticsLogEntry = DiagnosticsLogMessage | DiagnosticsScopeLogs;

/** @alpha */
export namespace DiagnosticsLogEntry { // eslint-disable-line @typescript-eslint/no-redeclare
  export function isMessage(entry: DiagnosticsLogEntry): entry is DiagnosticsLogMessage {
    return !!(entry as any).message;
  }
  export function isScope(entry: DiagnosticsLogEntry): entry is DiagnosticsScopeLogs {
    return !!(entry as any).scope;
  }
}

/** @alpha */
export interface ReadableSpan {
  name: string;
  kind: SpanKind;
  spanContext: () => { traceId: string, spanId: string, traceFlags: number };
  parentSpanId?: string;
  startTime: HrTime;
  endTime: HrTime;
  status: { code: number };
  attributes: Attributes;
  links: [];
  events: TimedEvent[];
  duration: HrTime;
  ended: boolean;
  resource: Resource;
  instrumentationLibrary: { name: string };
}

/** @internal */
export type HrTime = [number, number];

/** @internal */
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
export interface TimedEvent {
  time: HrTime;
  name: string;
  attributes: { [attributeKey: string]: string };
}

interface Attributes  {
  [attributeKey: string]: string;
}
