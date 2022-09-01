/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

/**
 * Type of diagnostics logger severity.
 * @beta
 */
export type DiagnosticsLoggerSeverity = "error" | "warning" | "info" | "debug" | "trace";

/**
 * Data structure for diagnostics information.
 * @beta
 */
export interface Diagnostics {
  logs?: DiagnosticsScopeLogs[];
}

/**
 * Data structure with client diagnostics information.
 * @beta
 */
export interface ClientDiagnostics extends Diagnostics {
  backendVersion?: string;
}

/**
 * Data structure for diagnostics options.
 * @beta
 */
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

/**
 * A function that can be called after receiving diagnostics.
 * @beta
 */
export type ClientDiagnosticsHandler = (logs: ClientDiagnostics) => void;

/**
 * Data structure for client diagnostics options.
 * @beta
 */
export interface ClientDiagnosticsOptions extends DiagnosticsOptions {
  backendVersion?: boolean;
  handler: ClientDiagnosticsHandler;
}

/**
 * Data structure which contains client diagnostics options.
 * @public
 */
export interface ClientDiagnosticsAttribute {
  /**
   * Diagnostics options.
   * @beta
   */
  diagnostics?: ClientDiagnosticsOptions;
}

/**
 * Data structure for diagnostics log message information.
 * @beta
 */
export interface DiagnosticsLogMessage {
  severity: {
    dev?: DiagnosticsLoggerSeverity;
    editor?: DiagnosticsLoggerSeverity;
  };
  category: string;
  message: string;
  timestamp: number;
}

/**
 * Data structure for diagnostics scope information.
 * @beta
 */
export interface DiagnosticsScopeLogs {
  scope: string;
  scopeCreateTimestamp?: number;
  duration?: number;
  logs?: DiagnosticsLogEntry[];
  attributes?: { [attributeKey: string]: string | string[] };
}

/**
 * Data structure for diagnostics log entry.
 * @beta
 */
export type DiagnosticsLogEntry = DiagnosticsLogMessage | DiagnosticsScopeLogs;

/**
 * Functions related to diagnostics log entry.
 * @beta
 */
export namespace DiagnosticsLogEntry { // eslint-disable-line @typescript-eslint/no-redeclare
  export function isMessage(entry: DiagnosticsLogEntry): entry is DiagnosticsLogMessage {
    return !!(entry as any).message;
  }
  export function isScope(entry: DiagnosticsLogEntry): entry is DiagnosticsScopeLogs {
    return !!(entry as any).scope;
  }
}
