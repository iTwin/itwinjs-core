/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import { AnyDiagnostic } from "./Diagnostic";
import assert = require("assert");

const translationNamespace = "ECSchemaMetaData";
const subTranslationNamespace = "Diagnostics";
const baseTranslationKey = translationNamespace + ":" + subTranslationNamespace;

/**
 * Interface used to report [[IDiagnostics]] objects created during schema validation.
 */
export interface IDiagnosticReporter {
  /** The I18N object to use for message translation. */
  i18N?: I18N;

  /**
   * Handles the given [[IDiagnostic]] based on the implementation requirements for a
   * given reporter.
   * @param diagnostic The diagnostic to report.
   */
  report(diagnostic: AnyDiagnostic): void;
}

/**
 * The abstract base class for all [[IDiagnosticReporter]] implementations.
 */
export abstract class DiagnosticReporterBase implements IDiagnosticReporter {
  constructor(i18n?: I18N) {
    this.i18N = i18n;
  }

  /** The I18N object to use for message translation. If undefined, no translation will occur. */
  public i18N?: I18N;

  /**
   * Prior to reporting the [[IDiagnostic]], the diagnostic message is formatted (with translations)
   * base on arguments contained in the diagnostic. Calls reportDiagnostic after the message is formatted.
   * @param diagnostic The diagnostic to report.
   */
  public report(diagnostic: AnyDiagnostic) {
    const message = this.formatMessage(diagnostic);
    this.reportDiagnostic(diagnostic, message);
  }

  /**
   * Handles the given [[IDiagnostic]] based on the implementation requirements for a
   * given reporter.
   * @param diagnostic The diagnostic to report.
   * @param messageText The formatted message.
   */
  protected abstract reportDiagnostic(diagnostic: AnyDiagnostic, messageText: string): void;

  /**
   * Helper method that formats string with provided arguments where the place holders
   * are in the the format '{0}', '{1}', etc.
   * @param text The text to format.
   * @param args The arguments to place in the text.
   * @param baseIndex The base index for the args, used for validation (typically 0, which is the default).
   */
  protected formatStringFromArgs(text: string, args: ArrayLike<string>, baseIndex = 0): string {
    return text.replace(/{(\d+)}/g, (_match, index: string) => this.assertDefined(args[+index + baseIndex]));
  }

  private formatMessage(diagnostic: AnyDiagnostic): string {
    let translatedMessage = this.translateMessage(diagnostic);

    if (diagnostic.messageArgs.length > 0) {
      translatedMessage = this.formatStringFromArgs(translatedMessage, diagnostic.messageArgs);
    }

    return translatedMessage;
  }

  private translateMessage(diagnostic: AnyDiagnostic): string {
    if (!this.i18N)
      return diagnostic.messageText;

    return this.i18N.translate(this.getTranslationKey(diagnostic));
  }

  private getTranslationKey(diagnostic: AnyDiagnostic): string {
    return baseTranslationKey + "." + diagnostic.code;
  }

  private assertDefined<T>(value: T | null | undefined, message?: string): T {
    if (value === undefined || value === null) return assert(false, message) as never;
    return value;
  }
}
