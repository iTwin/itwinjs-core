/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { parse as parseVersion } from "semver";
import { Element, IModelDb } from "@itwin/core-backend";
import { DbResult, Id64String } from "@itwin/core-bentley";
import {
  combineDiagnosticsSeverities,
  compareDiagnosticsSeverities,
  Diagnostics,
  DiagnosticsLogEntry,
  DiagnosticsOptions,
  InstanceKey,
} from "@itwin/presentation-common";

const presentation = require("@itwin/presentation-common/lib/cjs/assets/locales/en/Presentation.json"); // eslint-disable-line @typescript-eslint/no-var-requires

/** @internal */
export function getLocalizedStringEN(key: string) {
  let result = presentation;
  const [namespace, identifier] = key.split(":", 2);
  if (namespace !== "Presentation") {
    return key;
  }
  const keySteps = identifier.split(".");
  for (const keyStep of keySteps) {
    if (keyStep in result === false) {
      return key;
    }
    result = result[keyStep];
  }
  return typeof result === "string" ? result : key;
}

/** @internal */
export function getElementKey(imodel: IModelDb, id: Id64String): InstanceKey | undefined {
  let key: InstanceKey | undefined;
  const query = `SELECT ECClassId FROM ${Element.classFullName} e WHERE ECInstanceId = ?`;
  imodel.withPreparedStatement(query, (stmt) => {
    try {
      stmt.bindId(1, id);
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        key = { className: stmt.getValue(0).getClassNameForClassId().replace(".", ":"), id };
      }
    } catch {}
  });
  return key;
}

/** @internal */
export function normalizeVersion(version?: string) {
  if (version) {
    const parsedVersion = parseVersion(version, true);
    if (parsedVersion) {
      return `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch}`;
    }
  }
  return "0.0.0";
}

/**
 * A function that received request diagnostics and, optionally, request context.
 * @beta
 */
export type BackendDiagnosticsHandler<TContext = any> = (logs: Diagnostics, requestContext?: TContext) => void;

/**
 * Data structure for backend diagnostics options.
 * @beta
 */
export interface BackendDiagnosticsOptions<TContext = any> extends DiagnosticsOptions {
  /**
   * An optional function to supply request context that'll be passed to [[handler]] when
   * it's called after the request is fulfilled.
   */
  requestContextSupplier?: () => TContext;

  /**
   * Request diagnostics handler function that is called after the request is fulfilled. The handler
   * receives request diagnostics as the first argument and, optionally, request context as the
   * second (see [[requestContextSupplier]]).
   */
  handler: BackendDiagnosticsHandler<TContext>;
}

/**
 * Data structure which contains backend diagnostics options.
 * @public
 */
export interface BackendDiagnosticsAttribute {
  /**
   * Backend diagnostics options.
   * @beta
   */
  diagnostics?: BackendDiagnosticsOptions;
}

/** @internal */
export function combineDiagnosticsOptions(...options: Array<BackendDiagnosticsOptions | undefined>): DiagnosticsOptions | undefined {
  const combinedOptions: DiagnosticsOptions = {};
  options.forEach((d) => {
    if (!d) {
      return;
    }
    if (
      d.perf === true ||
      (typeof d.perf === "object" &&
        (!combinedOptions.perf || (typeof combinedOptions.perf === "object" && d.perf.minimumDuration < combinedOptions.perf.minimumDuration)))
    ) {
      combinedOptions.perf = d.perf;
    }
    const combinedDev = combineDiagnosticsSeverities(d.dev, combinedOptions.dev);
    if (combinedDev) {
      combinedOptions.dev = combinedDev;
    }
    const combinedEditor = combineDiagnosticsSeverities(d.editor, combinedOptions.editor);
    if (combinedEditor) {
      combinedOptions.editor = combinedEditor;
    }
  });
  return combinedOptions.dev || combinedOptions.editor || combinedOptions.perf ? combinedOptions : undefined;
}

/** @internal */
export function reportDiagnostics<TContext>(diagnostics: Diagnostics, options: BackendDiagnosticsOptions<TContext>, context?: TContext) {
  const stripped = diagnostics.logs ? stripDiagnostics(options, diagnostics.logs) : undefined;
  stripped && options.handler({ logs: stripped }, context);
}
function stripDiagnostics<TEntry extends DiagnosticsLogEntry>(options: DiagnosticsOptions, diagnostics: TEntry[]) {
  const stripped: TEntry[] = [];
  diagnostics.forEach((entry) => {
    if (DiagnosticsLogEntry.isScope(entry)) {
      const scopeLogs = stripDiagnostics(options, entry.logs ?? []);
      const strippedScope = { ...entry, logs: scopeLogs };
      if (!strippedScope.logs) {
        delete strippedScope.logs;
      }
      if (entry.duration !== undefined && (options.perf === true || (typeof options.perf === "object" && entry.duration >= options.perf.minimumDuration))) {
        stripped.push(strippedScope);
      } else if (scopeLogs) {
        delete strippedScope.duration;
        delete strippedScope.scopeCreateTimestamp;
        stripped.push(strippedScope);
      }
    } else {
      const matchesDevSeverity = entry.severity.dev && compareDiagnosticsSeverities(entry.severity.dev, options.dev) >= 0;
      const matchesEditorSeverity = entry.severity.editor && compareDiagnosticsSeverities(entry.severity.editor, options.editor) >= 0;
      if (matchesDevSeverity || matchesEditorSeverity) {
        stripped.push({ ...entry });
      }
    }
  });
  return stripped.length > 0 ? stripped : undefined;
}
