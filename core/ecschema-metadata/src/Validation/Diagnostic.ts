/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AnyClass, AnyECType } from "../Interfaces";
import { CustomAttributeContainerProps } from "../Metadata/CustomAttribute";
import { AnyProperty } from "../Metadata/Property";
import { RelationshipConstraint } from "../Metadata/RelationshipClass";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";

/**
 * Defines the possible diagnostic types.
 * @beta
 */
export const enum DiagnosticType {
  None,
  Schema,
  SchemaItem,
  Property,
  CustomAttributeContainer,
  RelationshipConstraint,
}

/**
 * Defines the possible diagnostic categories.
 * @beta
 */
export const enum DiagnosticCategory {
  Warning,
  Error,
  Suggestion,
  Message,
}

/**
 * The interface implemented by all diagnostics used during schema validation.
 * @beta
 */
export interface IDiagnostic<TYPE extends AnyECType, ARGS extends any[]> {
  /** The diagnostic category (error, warning, etc...). Value is static across all instances. */
  category: DiagnosticCategory;
  /** The unique string identifier of the diagnostic in the format '<ruleSetName>:<number>. Value is static across all instances. */
  code: string;
  /** The context type of diagnostic (schema, schema item, property, etc...). Value is static across all instances. */
  diagnosticType: DiagnosticType;
  /** The unformatted message text associated with the diagnostic. Value is static across all instances. */
  messageText: string;
  /** The arguments used when formatted the diagnostic instance's message. */
  messageArgs: ARGS;
  /** The EC object associated with the diagnostic instance. */
  ecDefinition: TYPE;
}

/**
 * Type which encapsulates all possible diagnostics.
 * @beta
 */
export type AnyDiagnostic = IDiagnostic<AnyECType, any[]>;

/**
 * The abstract base class for all [[IDiagnostic]] implementations.
 * @beta
 */
export abstract class BaseDiagnostic<TYPE extends AnyECType, ARGS extends any[]> implements IDiagnostic<TYPE, ARGS> {
  /**
   * Initializes a new BaseDiagnostic.
   * @param ecDefinition The EC object to associate with the diagnostic.
   * @param messageArgs The arguments used when formatting the diagnostic message.
   */
  constructor(ecDefinition: TYPE, messageArgs: ARGS) {
    this.ecDefinition = ecDefinition;
    this.messageArgs = messageArgs;
  }

  /** Gets the category of the diagnostic. */
  public abstract get category(): DiagnosticCategory;
  /** Gets the unique string identifier for the diagnostic in the format '<ruleSetName>:<number>'. */
  public abstract get code(): string;
  /** Gets the context type of the diagnostic (schema, schema item, property, etc...) */
  public abstract get diagnosticType(): DiagnosticType;
  /** Gets the message associated with the diagnostic. */
  public abstract get messageText(): string;

  /** The EC object to associate with the diagnostic. */
  public ecDefinition: TYPE;
  /** The arguments used when formatting the diagnostic message.  */
  public messageArgs: ARGS;
}

/**
 * An [[IDiagnostic]] implementation used for [[Schema]] diagnostics.
 * @beta
 */
export abstract class SchemaDiagnostic<ARGS extends any[]> extends BaseDiagnostic<Schema, ARGS> {
  public static diagnosticType = DiagnosticType.SchemaItem;

  constructor(schema: Schema, messageArgs: ARGS) {
    super(schema, messageArgs);
  }

  public get diagnosticType(): DiagnosticType { return DiagnosticType.Schema; }
}

/**
 * An [[IDiagnostic]] implementation used for [[SchemaItem]] diagnostics.
 * @beta
 */
export abstract class SchemaItemDiagnostic<TYPE extends AnyECType, ARGS extends any[]> extends BaseDiagnostic<TYPE, ARGS> {
  public static diagnosticType = DiagnosticType.SchemaItem;

  constructor(ecDefinition: TYPE, messageArgs: ARGS) {
    super(ecDefinition, messageArgs);
  }

  public get diagnosticType(): DiagnosticType { return DiagnosticType.SchemaItem; }
}

/**
 * An [[IDiagnostic]] implementation used for [[ECClass]] diagnostics.
 * @beta
 */
export abstract class ClassDiagnostic<ARGS extends any[]> extends SchemaItemDiagnostic<AnyClass, ARGS> {
  constructor(ecClass: AnyClass, messageArgs: ARGS) {
    super(ecClass, messageArgs);
  }
}

/**
 * An [[IDiagnostic]] implementation used for [[Property]] diagnostics.
 * @beta
 */
export abstract class PropertyDiagnostic<ARGS extends any[]> extends BaseDiagnostic<AnyProperty, ARGS> {
  constructor(property: AnyProperty, messageArgs: ARGS) {
    super(property, messageArgs);
  }

  public get diagnosticType(): DiagnosticType { return DiagnosticType.Property; }
}

/**
 * An [[IDiagnostic]] implementation used for [[RelationshipConstraint]] diagnostics.
 * @beta
 */
export abstract class RelationshipConstraintDiagnostic<ARGS extends any[]> extends BaseDiagnostic<RelationshipConstraint, ARGS> {
  constructor(constraint: RelationshipConstraint, messageArgs: ARGS) {
    super(constraint, messageArgs);
  }

  public get diagnosticType(): DiagnosticType { return DiagnosticType.RelationshipConstraint; }
}

/**
 * An [[IDiagnostic]] implementation used for [[CustomAttributeContainerProps]] diagnostics.
 * @beta
 */
export abstract class CustomAttributeContainerDiagnostic<ARGS extends any[]> extends BaseDiagnostic<CustomAttributeContainerProps, ARGS> {
  constructor(container: CustomAttributeContainerProps, messageArgs: ARGS) {
    super(container, messageArgs);
  }

  public get diagnosticType(): DiagnosticType { return DiagnosticType.CustomAttributeContainer; }
}

/**
 * Helper method for creating [[SchemaDiagnostic]] child classes.
 * @param code The string that uniquely identifies the diagnostic in the format '<ruleSetName>:<number>'.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 * @beta
 */
export function createSchemaDiagnosticClass<ARGS extends any[]>(code: string, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  validateCode(code);
  return class extends SchemaDiagnostic<ARGS> {
    public get code(): string { return code; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/**
 * Helper method for creating [[SchemaItemDiagnostic]] child classes.
 * @param code The string that uniquely identifies the diagnostic in the format '<ruleSetName>:<number>'.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 * @beta
 */
export function createSchemaItemDiagnosticClass<ITEM extends SchemaItem, ARGS extends any[]>(code: string, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  validateCode(code);
  return class extends SchemaItemDiagnostic<ITEM, ARGS> {
    public get code(): string { return code; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/**
 * Helper method for creating [[ClassDiagnostic]] child classes.
 * @param code The string that uniquely identifies the diagnostic in the format '<ruleSetName>:<number>'.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 * @beta
 */
export function createClassDiagnosticClass<ARGS extends any[]>(code: string, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  validateCode(code);
  return class extends ClassDiagnostic<ARGS> {
    public get code(): string { return code; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/**
 * Helper method for creating [[PropertyDiagnostic]] child classes.
 * @param code The string that uniquely identifies the diagnostic in the format '<ruleSetName>:<number>'.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 * @beta
 */
export function createPropertyDiagnosticClass<ARGS extends any[]>(code: string, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  validateCode(code);
  return class extends PropertyDiagnostic<ARGS> {
    public get code(): string { return code; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/**
 * Helper method for creating [[RelationshipConstraintDiagnostic]] child classes.
 * @param code The string that uniquely identifies the type of diagnostic in the format '<ruleSetName>:<number>'.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 * @beta
 */
export function createRelationshipConstraintDiagnosticClass<ARGS extends any[]>(code: string, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  validateCode(code);
  return class extends RelationshipConstraintDiagnostic<ARGS> {
    public get code(): string { return code; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/**
 * Helper method for creating [[CustomAttributeContainerDiagnostic]] child classes.
 * @param code The that uniquely identifies the type of diagnostic in the format '<ruleSetName>:<number>'.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 * @beta
 */
export function createCustomAttributeContainerDiagnosticClass<ARGS extends any[]>(code: string, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  validateCode(code);
  return class extends CustomAttributeContainerDiagnostic<ARGS> {
    public get code(): string { return code; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/** @beta */
export function diagnosticCategoryToString(category: DiagnosticCategory) {
  switch (category) {
    case DiagnosticCategory.Error:
      return "Error";
    case DiagnosticCategory.Warning:
      return "Warning";
    case DiagnosticCategory.Message:
      return "Message";
    case DiagnosticCategory.Suggestion:
      return "Suggestion";
  }
}

/** @beta */
export function diagnosticTypeToString(type: DiagnosticType) {
  switch (type) {
    case DiagnosticType.CustomAttributeContainer:
      return "CustomAttributeContainer";
    case DiagnosticType.None:
      return "None";
    case DiagnosticType.Property:
      return "Property";
    case DiagnosticType.RelationshipConstraint:
      return "RelationshipConstraint";
    case DiagnosticType.Schema:
      return "Schema";
    case DiagnosticType.SchemaItem:
      return "SchemaItem";
  }
}

function validateCode(code: string) {
  const msg = `Diagnostic code ${code} is invalid. Expected the format <ruleSetName>:<number>.`;
  const parts = code.split(":");
  if (parts.length !== 2) throw new Error(msg);
  if (isNaN(Number(parts[1]))) throw new Error(msg);
}
