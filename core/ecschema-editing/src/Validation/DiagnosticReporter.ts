/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Diagnostic
 */

import type { Localization } from "@itwin/core-common";
import type { AnyDiagnostic } from "./Diagnostic";

import assert = require("assert");

const translationNamespace = "ECSchemaMetaData";
const subTranslationNamespace = "Diagnostics";
const baseTranslationKey = `${translationNamespace}:${subTranslationNamespace}`;

/**
 * Interface used to report [[IDiagnostic]] objects created during schema validation.
 * @beta
 */
export interface IDiagnosticReporter {
  /**
   * A map where the key is a schema full name and the value is a collection
   * of diagnostics codes identifying which rules violations to ignore during validation.
   */
  suppressions?: Map<string, string[]>;

  /** The localization object to use for message translation. */
  localization?: Localization;

  /**
   * Handles the given [[IDiagnostic]] based on the implementation requirements for a
   * given reporter.
   * @param diagnostic The diagnostic to report.
   */
  report(diagnostic: AnyDiagnostic): void;
}

/**
 * An abstract base class for [[IDiagnosticReporter]] implementation that used the
 * provided Map to suppress certain rule violations from being reported. The Map's key
 * a schema full name, and the Map's value is a collection of rule codes to suppress.
 * @beta
 */
export abstract class SuppressionDiagnosticReporter implements IDiagnosticReporter {
  private _suppressions?: Map<string, string[]>;

  /**
   * Initializes a new SuppressionDiagnosticReporter
   * @param suppressions A Map where the key is a schema full name and the value is collection of diagnostic codes to suppress.
   */
  constructor(suppressions?: Map<string, string[]>) {
    this._suppressions = suppressions;
  }

  /**
   * Gets the collection of ISchemaDiagnosticSuppression objects that identify
   * rules violations to ignore during validation.
   */
  public get suppressions(): Map<string, string[]> | undefined {
    return this._suppressions;
  }

  /**
   * Prior to reporting the [[IDiagnostic]], the diagnostic message is formatted (with translations)
   * base on arguments contained in the diagnostic. Calls reportDiagnostic after the message is formatted.
   * @param diagnostic The diagnostic to report.
   */
  public report(diagnostic: AnyDiagnostic) {
    if (this._suppressions && this._suppressions.has(diagnostic.schema.fullName)) {
      const suppressedCodes = this._suppressions.get(diagnostic.schema.fullName);
      if (suppressedCodes!.includes(diagnostic.code))
        return;
    }

    this.reportInternal(diagnostic);
  }

  /**
   * Handles the given [[IDiagnostic]] based on the implementation requirements for a
   * given reporter.
   * @param diagnostic The diagnostic to report.
   */
  protected abstract reportInternal(diagnostic: AnyDiagnostic): void;
}

/**
 * An abstract [[SuppressionDiagnosticReporter]] implementation that formats the
 * diagnostic message with the message args. If a Localization implementation is specified,
 * the message will also be translated.
 * @beta
 */
export abstract class FormatDiagnosticReporter extends SuppressionDiagnosticReporter {
  /**
   * Initializes a new FormatDiagnosticReporter
   * @param suppressions A Map where the key is a schema full name and the value is collection of diagnostic codes to suppress.
   * @param localization The Localization instance to use to translate validation messages.
   */
  constructor(suppressions?: Map<string, string[]>, localization?: Localization) {
    super(suppressions);
    this.localization = localization;
  }

  /** The Localization object to use for message translation. If undefined, no translation will occur. */
  public localization?: Localization;

  /**
   * Prior to reporting the [[IDiagnostic]], the diagnostic message is formatted (with translations)
   * base on arguments contained in the diagnostic. Calls reportDiagnostic after the message is formatted.
   * @param diagnostic The diagnostic to report.
   */
  public reportInternal(diagnostic: AnyDiagnostic) {
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

    if (diagnostic.messageArgs && diagnostic.messageArgs.length > 0)
      translatedMessage = this.formatStringFromArgs(translatedMessage, diagnostic.messageArgs);
    return translatedMessage;
  }

  private translateMessage(diagnostic: AnyDiagnostic): string {
    if (!this.localization)
      return diagnostic.messageText;

    return this.localization.getLocalizedString(this.getTranslationKey(diagnostic));
  }

  private getTranslationKey(diagnostic: AnyDiagnostic): string {
    return `${baseTranslationKey}.${diagnostic.code}`;
  }

  private assertDefined<T>(value: T | null | undefined, message?: string): T {
    if (value === undefined || value === null) return assert(false, message) as never;
    return value;
  }
}
