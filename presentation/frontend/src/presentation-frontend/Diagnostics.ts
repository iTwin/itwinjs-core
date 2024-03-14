/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import {
  ClientDiagnostics,
  ClientDiagnosticsHandler,
  DiagnosticsLogEntry,
  DiagnosticsLoggerSeverity,
  DiagnosticsLogMessage,
  DiagnosticsScopeLogs,
} from "@itwin/presentation-common";

/**
 * A function which logs messages to the console.
 * @beta
 */
export function consoleDiagnosticsHandler(diagnostics: ClientDiagnostics) {
  // eslint-disable-next-line no-console
  diagnostics.backendVersion && console.log(`Backend version: ${diagnostics.backendVersion}`);
  diagnostics.logs &&
    handleDiagnosticLogs(diagnostics.logs, (msg: DiagnosticsLogMessage, stack: DiagnosticsScopeLogs[]) => {
      /* note: we're duplicating the message if it's logged at both editor and dev severity levels */
      const str = buildLogMessageString(msg, stack);
      if (msg.severity.editor) {
        getConsoleLogFunc(msg.severity.editor)(str);
      }
      if (msg.severity.dev) {
        getConsoleLogFunc(msg.severity.dev)(str);
      }
    });
}

/**
 * A function which calls all diagnostics handlers passed to it.
 * @beta
 */
export function createCombinedDiagnosticsHandler(handlers: ClientDiagnosticsHandler[]) {
  return (diagnostics: ClientDiagnostics) => {
    handlers.forEach((handler) => handler(diagnostics));
  };
}

type DiagnosticsLogMessageHandler = (msg: DiagnosticsLogMessage, stack: DiagnosticsScopeLogs[]) => void;

function handleDiagnosticLogs(logs: DiagnosticsLogEntry[], messageHandler: DiagnosticsLogMessageHandler, stack: DiagnosticsScopeLogs[] = []) {
  logs.forEach((log) => {
    if (DiagnosticsLogEntry.isMessage(log)) {
      messageHandler(log, stack);
    } else if (log.logs) {
      handleDiagnosticLogs(log.logs, messageHandler, [...stack, log]);
    }
  });
}

function buildLogMessageString(msg: DiagnosticsLogMessage, _stack: DiagnosticsScopeLogs[]) {
  return msg.message;
}

function getConsoleLogFunc(severity: DiagnosticsLoggerSeverity) {
  switch (severity) {
    case "error":
      return console.error; // eslint-disable-line no-console
    case "warning":
      return console.warn; // eslint-disable-line no-console
    case "info":
    case "debug":
    case "trace":
      return console.log; // eslint-disable-line no-console
  }
}
