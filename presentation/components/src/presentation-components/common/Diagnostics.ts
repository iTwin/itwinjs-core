/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { ClientDiagnosticsHandler, ClientDiagnosticsOptions, DiagnosticsLoggerSeverity, DiagnosticsOptions } from "@itwin/presentation-common";
import { createCombinedDiagnosticsHandler } from "@itwin/presentation-frontend";

/**
 * Settings for capturing diagnostics data.
 * @public
 */
export interface DiagnosticsProps {
  /**
   * Settings for capturing rule diagnostics.
   * @alpha
   */
  ruleDiagnostics?: {
    /** Severity of log messages to capture. Defaults to "error" when not set. */
    severity?: DiagnosticsLoggerSeverity;
    /** Handler of resulting logs. */
    handler: ClientDiagnosticsHandler;
  };

  /**
   * Settings for capturing rules engine diagnostics.
   * @internal
   */
  devDiagnostics?: {
    /** Severity of log messages to capture. Defaults to "error" when not set. */
    severity?: DiagnosticsLoggerSeverity;
    /** Should performance metric be captured. */
    perf?: boolean | { minimumDuration: number };
    /** Get version of presentation backend. */
    backendVersion?: boolean;
    /** Handler of resulting logs. */
    handler: ClientDiagnosticsHandler;
  };
}

/**
 * Creates diagnostics options that can be passed to presentation requests based on given
 * diagnostics props.
 *
 * @alpha
 */
export function createDiagnosticsOptions(props: DiagnosticsProps): ClientDiagnosticsOptions | undefined {
  if (!props.ruleDiagnostics && !props.devDiagnostics)
    return undefined;

  const options: DiagnosticsOptions = {};
  if (props.devDiagnostics?.perf)
    options.perf = props.devDiagnostics.perf;
  if (props.devDiagnostics?.severity)
    options.dev = props.devDiagnostics.severity;
  if (props.ruleDiagnostics?.severity)
    options.editor = props.ruleDiagnostics.severity;

  let handler: ClientDiagnosticsHandler;
  // istanbul ignore else
  if (props.devDiagnostics && props.ruleDiagnostics && props.devDiagnostics.handler !== props.ruleDiagnostics.handler)
    handler = createCombinedDiagnosticsHandler([props.devDiagnostics.handler, props.ruleDiagnostics.handler]);
  else if (props.devDiagnostics)
    handler = props.devDiagnostics.handler;
  else if (props.ruleDiagnostics)
    handler = props.ruleDiagnostics.handler;

  return {
    ...options,
    ...(props.devDiagnostics?.backendVersion ? { backendVersion: props.devDiagnostics.backendVersion } : undefined),
    handler: handler!,
  };
}
