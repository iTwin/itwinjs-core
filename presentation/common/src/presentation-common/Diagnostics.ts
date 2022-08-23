/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

/** @beta */
export type DiagnosticsLoggerSeverity = "error" | "warning" | "info" | "debug" | "trace";

/** @beta */
export interface Diagnostics {
  logs?: DiagnosticsScopeLogs[];
}

/** @beta */
export interface ClientDiagnostics extends Diagnostics {
  backendVersion?: string;
}

/** @beta */
export interface DiagnosticsOptions {
  /**
   * Flag specifying that performance should be measured, or
   * minimum duration in milliseconds for which performance metric should be included.
   */
  perf?: boolean | { minimumDuration: number };
  /** Severity for developer log messages */
  dev?: boolean | DiagnosticsLoggerSeverity;
  /** Severity for presentation rules' editor log messages */
  editor?: boolean | DiagnosticsLoggerSeverity;
}

/** @beta */
export type ClientDiagnosticsHandler = (logs: ClientDiagnostics) => void;

/** @beta */
export interface ClientDiagnosticsOptions extends DiagnosticsOptions {
  backendVersion?: boolean;
  handler: ClientDiagnosticsHandler;
}

/** @public */
export interface ClientDiagnosticsAttribute {
  /** @beta */
  diagnostics?: ClientDiagnosticsOptions;
}

/** @beta */
export interface DiagnosticsLogMessage {
  severity: {
    dev?: DiagnosticsLoggerSeverity;
    editor?: DiagnosticsLoggerSeverity;
  };
  category: string;
  message: string;
  timestamp: number;
}

/** @beta */
export interface DiagnosticsScopeLogs {
  scope: string;
  scopeCreateTimestamp?: number;
  duration?: number;
  logs?: DiagnosticsLogEntry[];
  attributes?: { [attributeKey: string]: string | string[] };
}

/** @beta */
export type DiagnosticsLogEntry = DiagnosticsLogMessage | DiagnosticsScopeLogs;

/** @beta */
export namespace DiagnosticsLogEntry { // eslint-disable-line @typescript-eslint/no-redeclare
  export function isMessage(entry: DiagnosticsLogEntry): entry is DiagnosticsLogMessage {
    return !!(entry as any).message;
  }
  export function isScope(entry: DiagnosticsLogEntry): entry is DiagnosticsScopeLogs {
    return !!(entry as any).scope;
  }
}
