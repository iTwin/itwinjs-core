/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Diagnostic
 */

import { Logger } from "@itwin/core-bentley";
import { AnyDiagnostic, DiagnosticCategory } from "./Diagnostic";
import { FormatDiagnosticReporter } from "./DiagnosticReporter";

const loggingCategory = "ecschema-metadata";

/**
 * An [[IDiagnosticReporter]] for logging [[IDiagnostic]] objects.
 * @beta
 */
export class LoggingDiagnosticReporter extends FormatDiagnosticReporter {
  public reportDiagnostic(diagnostic: AnyDiagnostic, messageText: string) {
    switch (diagnostic.category) {
      case DiagnosticCategory.Error:
        Logger.logError(loggingCategory, messageText, () => this.getLogMetaData(diagnostic));
        return;
      case DiagnosticCategory.Warning:
        Logger.logWarning(loggingCategory, messageText, () => this.getLogMetaData(diagnostic));
        return;
      case DiagnosticCategory.Message:
      case DiagnosticCategory.Suggestion:
        Logger.logInfo(loggingCategory, messageText, () => this.getLogMetaData(diagnostic));
        return;
      default:
        Logger.logTrace(loggingCategory, messageText, () => this.getLogMetaData(diagnostic));
    }
  }

  private getLogMetaData(diagnostic: AnyDiagnostic) {
    return { ...diagnostic, ...{ code: diagnostic.code, category: diagnostic.category, diagnosticType: diagnostic.diagnosticType, messageText: undefined, messageArgs: undefined } };
  }
}
