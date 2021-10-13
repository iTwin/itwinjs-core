/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { DiagnosticsHandler, DiagnosticsLoggerSeverity, DiagnosticsOptions, DiagnosticsOptionsWithHandler } from "@itwin/presentation-common";
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
    handler: DiagnosticsHandler;
  };

  /**
   * Settings for capturing rules engine diagnostics.
   * @internal
   */
  devDiagnostics?: {
    /** Severity of log messages to capture. Defaults to "error" when not set. */
    severity?: DiagnosticsLoggerSeverity;
    /** Should performance metric be captured. */
    perf?: boolean;
    /** Handler of resulting logs. */
    handler: DiagnosticsHandler;
  };
}

/**
 * Creates diagnostics options that can be passed to presentation requests based on given
 * diagnostics props.
 *
 * @alpha
 */
export function createDiagnosticsOptions(props: DiagnosticsProps): DiagnosticsOptionsWithHandler | undefined {
  if (!props.ruleDiagnostics && !props.devDiagnostics)
    return undefined;

  const options: DiagnosticsOptions = {};
  if (props.devDiagnostics?.perf)
    options.perf = true;
  if (props.devDiagnostics?.severity)
    options.dev = props.devDiagnostics.severity;
  if (props.ruleDiagnostics?.severity)
    options.editor = props.ruleDiagnostics.severity;

  let handler: DiagnosticsHandler;
  // istanbul ignore else
  if (props.devDiagnostics && props.ruleDiagnostics && props.devDiagnostics.handler !== props.ruleDiagnostics.handler)
    handler = createCombinedDiagnosticsHandler([props.devDiagnostics.handler, props.ruleDiagnostics.handler]);
  else if (props.devDiagnostics)
    handler = props.devDiagnostics.handler;
  else if (props.ruleDiagnostics)
    handler = props.ruleDiagnostics.handler;

  return {
    ...options,
    handler: handler!,
  };
}
