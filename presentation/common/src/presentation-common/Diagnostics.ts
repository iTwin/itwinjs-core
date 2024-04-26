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
 * Returns lower severity of the given two. Examples:
 * ```
 * combineDiagnosticsSeverities("error", "error") === "error"
 * combineDiagnosticsSeverities("error", "debug") === "debug"
 * combineDiagnosticsSeverities("debug", "error") === "debug"
 * ```
 * @internal
 */
export function combineDiagnosticsSeverities(lhs: undefined | boolean | DiagnosticsLoggerSeverity, rhs: undefined | boolean | DiagnosticsLoggerSeverity) {
  if (!lhs && !rhs) {
    return undefined;
  }
  const combinedSeverity: DiagnosticsLoggerSeverity =
    lhs === "trace" || rhs === "trace"
      ? "trace"
      : lhs === "debug" || lhs === true || rhs === "debug" || rhs === true
        ? "debug"
        : lhs === "info" || rhs === "info"
          ? "info"
          : lhs === "warning" || rhs === "warning"
            ? "warning"
            : "error";
  return combinedSeverity;
}

/**
 * Returns 0 if the given severities are equal after normalization, negative if `lhs` is lower, positive if higher. Examples:
 * ```
 * compareDiagnosticsSeverities("error", "error") === 0
 * compareDiagnosticsSeverities("error", false) === 0
 * compareDiagnosticsSeverities("error", undefined) === 0
 * compareDiagnosticsSeverities("debug", true) === 0
 * compareDiagnosticsSeverities("debug", "error") < 0
 * compareDiagnosticsSeverities("error", "debug") > 0
 * ```
 * @internal
 */
export function compareDiagnosticsSeverities(lhs: undefined | boolean | DiagnosticsLoggerSeverity, rhs: undefined | boolean | DiagnosticsLoggerSeverity) {
  const normalizedLhs: DiagnosticsLoggerSeverity = lhs === undefined || lhs === false ? "error" : lhs === true ? "debug" : lhs;
  const normalizedRhs: DiagnosticsLoggerSeverity = rhs === undefined || rhs === false ? "error" : rhs === true ? "debug" : rhs;
  if (normalizedLhs === normalizedRhs) {
    return 0;
  }
  if (normalizedLhs === "error") {
    return 1;
  }
  if (normalizedLhs === "warning") {
    return normalizedRhs === "error" ? -1 : 1;
  }
  if (normalizedLhs === "info") {
    return normalizedRhs === "warning" || normalizedRhs === "error" ? -1 : 1;
  }
  if (normalizedLhs === "debug") {
    return normalizedRhs === "info" || normalizedRhs === "warning" || normalizedRhs === "error" ? -1 : 1;
  }
  return -1;
}

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
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace DiagnosticsLogEntry {
  export function isMessage(entry: DiagnosticsLogEntry): entry is DiagnosticsLogMessage {
    return !!(entry as any).message;
  }
  export function isScope(entry: DiagnosticsLogEntry): entry is DiagnosticsScopeLogs {
    return !!(entry as any).scope;
  }
}
