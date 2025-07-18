/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/ban-ts-comment */
/** @packageDocumentation
 * @module Core
 */

import { parse as parseVersion } from "semver";
import { IModelDb } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { Diagnostics, DiagnosticsLogEntry, DiagnosticsOptions, InstanceKey } from "@itwin/presentation-common";
import { combineDiagnosticsSeverities, compareDiagnosticsSeverities } from "@itwin/presentation-common/internal";
// @ts-ignore TS complains about `with` in CJS builds, but not ESM
import presentationStrings from "@itwin/presentation-common/locales/en/Presentation.json" with { type: "json" };

/** @internal */
export function getLocalizedStringEN(key: string) {
  let result: object | string = presentationStrings;
  const [namespace, identifier] = key.split(":", 2);
  if (namespace !== "Presentation") {
    return key;
  }
  const keySteps = identifier.split(".");
  for (const keyStep of keySteps) {
    if (typeof result !== "object" || keyStep in result === false) {
      return key;
    }
    result = result[keyStep as keyof typeof result];
  }
  return typeof result === "string" ? result : key;
}

/** @internal */
export function getElementKey(imodel: IModelDb, id: Id64String): InstanceKey | undefined {
  const className = imodel.elements.tryGetElementProps(id)?.classFullName;
  return className ? { className, id } : undefined;
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
 * @public
 */
export type BackendDiagnosticsHandler<TContext = any> = (logs: Diagnostics, requestContext?: TContext) => void;

/**
 * Data structure for backend diagnostics options.
 * @public
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
   * @public
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
