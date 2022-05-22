/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

/** @alpha */
export type DiagnosticsLoggerSeverity = "error" | "warning" | "info" | "debug" | "trace";

/** @alpha */
export interface DiagnosticsOptions {
  /** Measure performance */
  perf?: boolean;
  /** Severity for developer log messages */
  dev?: boolean | DiagnosticsLoggerSeverity;
  /** Severity for presentation rules' editor log messages */
  editor?: boolean | DiagnosticsLoggerSeverity;
}

/** @alpha */
export type DiagnosticsHandler = (logs: DiagnosticsScopeLogs[]) => void;

/** @alpha */
export interface DiagnosticsOptionsWithHandler extends DiagnosticsOptions {
  handler: DiagnosticsHandler;
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
