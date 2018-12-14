/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Diagnostic, DiagnosticCategory, IDiagnosticReporter } from "./Diagnostics";
import { ECValidationError } from "./ValidationException";
import { Logger } from "@bentley/bentleyjs-core";

const loggingCategory = "ecschema-metadata";

/** A [[DiagnosticReporter]] for logging [[Diagnostic]] objects.  */
export class LoggingDiagnosticReporter implements IDiagnosticReporter {
  public report(diagnostic: Diagnostic) {
    switch (diagnostic.category) {
      case DiagnosticCategory.Error:
        Logger.logError(loggingCategory, diagnostic.defaultMessageText, () => this.getLogMetaData(diagnostic));
        return;
      case DiagnosticCategory.Warning:
        Logger.logWarning(loggingCategory, diagnostic.defaultMessageText, () => this.getLogMetaData(diagnostic));
        return;
      case DiagnosticCategory.Message:
      case DiagnosticCategory.Suggestion:
        Logger.logInfo(loggingCategory, diagnostic.defaultMessageText, () => this.getLogMetaData(diagnostic));
        return;
      default:
        Logger.logTrace(loggingCategory, diagnostic.defaultMessageText, () => this.getLogMetaData(diagnostic));
    }
  }

  private getLogMetaData(diagnostic: Diagnostic) {
    return { ...diagnostic, ...{ messageText: undefined, defaultMessageText: undefined } };
  }
}

/** A [[DiagnosticReporter]] for throwing errors for a given [[Diagnostic]] object. */
export class ExceptionDiagnosticReporter implements IDiagnosticReporter {
  public report(diagnostic: Diagnostic) {
    if (diagnostic.category === DiagnosticCategory.Error)
      throw new ECValidationError(diagnostic.code, diagnostic.messageText);
  }
}

/** A [[DiagnosticReporter]] for storing all reported [[Diagnostic]] objects in a collection. */
export class CollectionDiagnosticReporter implements IDiagnosticReporter {
  private _diagnostics: Diagnostic[] = [];

  public report(diagnostic: Diagnostic) {
    this._diagnostics.push(diagnostic);
  }

  public get ReportedDiagnostics(): Diagnostic[] {
    return this._diagnostics;
  }
}
