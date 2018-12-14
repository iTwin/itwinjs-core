/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { I18N } from "@bentley/imodeljs-i18n";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";
import * as Diagnostics from "./Diagnostics";
import assert = require("assert");

const translationNamespace = "ECSchemaMetaData";
const subTranslationNamespace = "Diagnostics";
const baseTranslationKey = translationNamespace + ":" + subTranslationNamespace;

/**
 * A utility class that 'reports' messages defined as [[DiagnosticMessage]] objects. [[DiagnosticReporter]] objects may be registered using
 * the static method [[SchemaDiagnosticReporter.registerReporter]].
 */
export class SchemaDiagnosticReporter {
  private static _reporters: Diagnostics.IDiagnosticReporter[] = [];
  private static _initialized = false;

  /** The [[I18N]] for this session. */
  public static i18n?: I18N;

  /** Indicates the reporter has been initialized and ready for use. */
  public static get initialized() { return SchemaDiagnosticReporter._initialized; }

  /** Gets the registered reporters. */
  public static get reporters() { return SchemaDiagnosticReporter._reporters; }

  /**
   * Initializes the [[SchemaDiagnosticReporter]] instance.
   * @param i18n The I18N used to for translation of messages. If not specified all messages will be in english.
   */
  public static async startup(i18n?: I18N) {
    if (SchemaDiagnosticReporter._initialized)
      return;

    SchemaDiagnosticReporter.i18n = i18n;
    if (SchemaDiagnosticReporter.i18n)
      await SchemaDiagnosticReporter.i18n.registerNamespace(translationNamespace).readFinished;

    SchemaDiagnosticReporter._initialized = true;
  }

  /** Un-initializes the reporter. */
  public static shutdown() {
    this.unregisterAllReporters();
    this._initialized = false;
  }

  /**
   * Registers a [[DiagnosticReporter]] which will be called when calling [[SchemaDiagnosticReporter.reportDiagnostic]].
   * @param reporter The [[DiagnosticReporter]] to register.
   */
  public static registerReporter(reporter: Diagnostics.IDiagnosticReporter) {
    this._reporters.push(reporter);
  }

  /**
   * Calls all registered [[DiagnosticReporter]] objects with the given [[DiagnosticMessage]].
   * @param message The [[DiagnosticMessage]] to report.
   * @param args Any parameters required for message formatting.
   */
  public static reportDiagnostic(message: Diagnostics.DiagnosticMessage, ...args: Array<string | number | undefined>) {
    if (!this._initialized)
      throw new Error("SchemaDiagnosticReporter uninitialized");

    const diagnostic = this.createDiagnostic(message, ...args);
    this.report(diagnostic);
  }

  /**
   * Calls all registered [[DiagnosticReporter]] objects with the given [[DiagnosticMessage]].
   * @param schema The [[Schema]] associated with the given message.
   * @param message The [[DiagnosticMessage]] to report.
   * @param args Any parameters required for message formatting.
   */
  public static reportSchemaDiagnostic(schema: Schema, message: Diagnostics.DiagnosticMessage, ...args: Array<string | number | undefined>): any {
    if (!this._initialized)
      throw new Error("SchemaDiagnosticReporter uninitialized");

    const diagnostic = this.createSchemaDiagnostic(schema, message, ...args);
    this.report(diagnostic);
  }

  /**
   * Calls all registered [[DiagnosticReporter]] objects with the given [[DiagnosticMessage]].
   * @param schemaItem The [[SchemaItem]] associated with the given message.
   * @param message The [[DiagnosticMessage]] to report.
   * @param args Any parameters required for message formatting.
   */
  public static reportSchemaItemDiagnostic(schemaItem: SchemaItem, message: Diagnostics.DiagnosticMessage, ...args: Array<string | number | undefined>): any {
    if (!this._initialized)
      throw new Error("SchemaDiagnosticReporter uninitialized");

    const diagnostic = this.createSchemaItemDiagnostic(schemaItem, message, ...args);
    this.report(diagnostic);
  }

  /**
   * Calls all registered [[DiagnosticReporter]] objects with the given [[DiagnosticMessage]].
   * @param schemaItem The [[SchemaItem]] associated with the given message.
   * @param propertyName The property name associated with the given message.
   * @param message The [[DiagnosticMessage]] to report.
   * @param args Any parameters required for message formatting.
   */
  public static reportSchemaPropertyDiagnostic(schemaItem: SchemaItem, propertyName: string, message: Diagnostics.DiagnosticMessage, ...args: Array<string | number | undefined>): any {
    if (!this._initialized)
      throw new Error("SchemaDiagnosticReporter uninitialized");

    const diagnostic = this.createSchemaPropertyDiagnostic(schemaItem, propertyName, message, ...args);
    this.report(diagnostic);
  }

  /** Removes all registered  [[DiagnosticReporter]] instances. */
  public static unregisterAllReporters() {
    this._reporters = [];
  }

  /**
   * A utility method that can be called by registered reporters that will translate the given
   * [[DiagnosticMessage]] to the configured language.
   * @param message The [[DiagnosticMessage]] to translate.
   *
   */
  public static translateMessage(message: Diagnostics.DiagnosticMessage): string {
    if (!SchemaDiagnosticReporter.i18n)
      return message.message;

    return SchemaDiagnosticReporter.i18n.translate(this.getTranslationKey(message));
  }

  private static report(diagnostic: Diagnostics.Diagnostic) {
    for (const reporterEntry of this._reporters) {
      reporterEntry.report(diagnostic);
    }
  }

  private static getTranslationKey(message: Diagnostics.DiagnosticMessage): string {
    return baseTranslationKey + "." + message.key;
  }

  private static createDiagnostic(message: Diagnostics.DiagnosticMessage, ...args: Array<string | number | undefined>): Diagnostics.Diagnostic {
    let translation = SchemaDiagnosticReporter.translateMessage(message);
    let defaultText = message.message;

    if (args.length > 0) {
      translation = this.formatStringFromArgs(translation, arguments, 1);
      defaultText = this.formatStringFromArgs(defaultText, arguments, 1);
    }

    return {
      schema: undefined,
      schemaItem: undefined,
      schemaItemType: undefined,
      propertyName: undefined,

      defaultMessageText: defaultText,
      messageText: translation,
      category: message.category,
      code: message.code,
    };
  }

  private static createSchemaDiagnostic(schema: Schema, message: Diagnostics.DiagnosticMessage, ...args: Array<string | number | undefined>): Diagnostics.DiagnosticWithSchema {
    const diagnostic = this.createDiagnostic(message, ...args);
    diagnostic.schema = schema;

    return diagnostic as Diagnostics.DiagnosticWithSchema;
  }

  private static createSchemaItemDiagnostic(schemaItem: SchemaItem, message: Diagnostics.DiagnosticMessage, ...args: Array<string | number | undefined>): Diagnostics.DiagnosticWithSchemaItem {
    const diagnostic = this.createSchemaDiagnostic(schemaItem.schema, message, ...args);
    diagnostic.schemaItem = schemaItem;

    return diagnostic as Diagnostics.DiagnosticWithSchemaItem;
  }

  private static createSchemaPropertyDiagnostic(schemaItem: SchemaItem, propertyName: string, message: Diagnostics.DiagnosticMessage, ...args: Array<string | number | undefined>): Diagnostics.DiagnosticWithProperty {
    const diagnostic = this.createSchemaItemDiagnostic(schemaItem, message, ...args);
    diagnostic.propertyName = propertyName;

    return diagnostic as Diagnostics.DiagnosticWithProperty;
  }

  private static formatStringFromArgs(text: string, args: ArrayLike<string>, baseIndex = 0): string {
    return text.replace(/{(\d+)}/g, (_match, index: string) => this.assertDefined(args[+index + baseIndex]));
  }

  private static assertDefined<T>(value: T | null | undefined, message?: string): T {
    if (value === undefined || value === null) return assert(false, message) as never;
    return value;
  }
}
