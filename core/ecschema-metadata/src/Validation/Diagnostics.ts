/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { SchemaItemType } from "../ECObjects";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";

export enum ECValidationStatus {
  VALIDATION_ERROR_BASE = 0x98EC,
  Success = 0,
  BaseClassIsSealed = VALIDATION_ERROR_BASE + 1,
  BaseClassOfDifferentType = VALIDATION_ERROR_BASE + 2,
}

function createMessage(code: number, category: DiagnosticCategory, diagnosticType: DiagnosticType, key: string, message: string): DiagnosticMessage {
  return { code, category, diagnosticType, key, message };
}

export function isDiagnostic(obj: any): obj is Diagnostic {
  return !!obj &&
        typeof obj === "object" &&
        "category" in obj &&
        "code" in obj &&
        "messageText" in obj &&
        "defaultMessageText" in obj;
}

export function isSchemaDiagnostic(obj: any): obj is DiagnosticWithSchema {
  return isDiagnostic(obj) && "schema" in obj;
}

export function isSchemaItemDiagnostic(obj: any): obj is DiagnosticWithSchema {
  return isSchemaDiagnostic(obj) && "schemaItem" in obj;
}

export function isPropertyDiagnostic(obj: any): obj is DiagnosticWithSchema {
  return isSchemaItemDiagnostic(obj) && "propertyName" in obj;
}

/** Interface used to report [[Diagnostic]] objects. */
export interface IDiagnosticReporter {
  report (diagnostic: Diagnostic): any;
}

/** Interface that defines the required structure of a diagnostic message. */
export interface DiagnosticMessage {
  key: string;
  category: DiagnosticCategory;
  diagnosticType: DiagnosticType;
  code: ECValidationStatus;
  message: string;
}

/** Defines the possible diagnostic categories. */
export enum DiagnosticCategory {
  Warning,
  Error,
  Suggestion,
  Message,
}

/** Defines the possible diagnostic types. */
export enum DiagnosticType {
  None,
  Schema,
  SchemaItem,
  Property,
}

/* Interface that defines the structure of a Diagnostic */
export interface Diagnostic extends DiagnosticRelatedInformation {
  relatedInformation?: DiagnosticRelatedInformation[];
}

/* Interface that defines all the possible information of a Diagnostic */
export interface DiagnosticRelatedInformation {
  category: DiagnosticCategory;
  code: ECValidationStatus;
  schema: Schema | undefined;
  schemaItem: SchemaItem | undefined;
  schemaItemType: SchemaItemType | undefined;
  propertyName: string | undefined;
  messageText: string;
  defaultMessageText: string;
}

/* Interface that defines a [[Diagnostic]] in the context of a [[Schema]].*/
export interface DiagnosticWithSchema extends Diagnostic {
  schema: Schema;
}

/* Interface that defines a [[Diagnostic]] with the context of a [[SchemaItem]].*/
export interface DiagnosticWithSchemaItem extends DiagnosticWithSchema {
  schemaItem: SchemaItem;
}

/* Interface that defines a [[Diagnostic]] that contains property information.*/
export interface DiagnosticWithProperty extends DiagnosticWithSchemaItem {
  propertyName: string;
}

/**
 * The list of [[DiagnosticMessage]] objects supported by the schema diagnostics framework.
 */
export const DIAGNOSTICS = {
  /** Required message parameters: childClass.FullName, baseClass.FullName */
  BaseClassIsSealed: createMessage(ECValidationStatus.BaseClassIsSealed, DiagnosticCategory.Error, DiagnosticType.SchemaItem, ECValidationStatus[ECValidationStatus.BaseClassIsSealed], "Class '{0}' cannot derive from sealed base class '{1}'."),
  /** Required message parameters: childClass.FullName, baseClass.FullName, baseClass.schemaItemType */
  BaseClassOfDifferentType: createMessage(ECValidationStatus.BaseClassOfDifferentType, DiagnosticCategory.Error, DiagnosticType.SchemaItem, ECValidationStatus[ECValidationStatus.BaseClassOfDifferentType], "Class '{0}' cannot derive from base class '{1}' of type '{2}'."),
};
