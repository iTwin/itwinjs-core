/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@bentley/bentleyjs-core";
import { AnyDiagnostic, DiagnosticCategory } from "./Diagnostic";
import { DiagnosticReporterBase } from "./DiagnosticReporter";

const loggingCategory = "ecschema-metadata";

/** An [[IDiagnosticReporter]] for logging [[IDiagnostic]] objects.  */
export class LoggingDiagnosticReporter extends DiagnosticReporterBase {
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
